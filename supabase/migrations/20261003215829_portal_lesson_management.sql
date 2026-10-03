-- Phase 2E: own cancellation/rescheduling, without changing existing domain rules.
begin;
create table booking_private.portal_lesson_requests (
  request_id uuid primary key,
  student_id uuid not null references booking_private.students(id),
  booking_id uuid not null references booking_private.bookings(id),
  action text not null check(action in ('cancel','reschedule')),
  fingerprint jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index portal_lesson_requests_student_idx on booking_private.portal_lesson_requests(student_id);
create index portal_lesson_requests_booking_idx on booking_private.portal_lesson_requests(booking_id);
alter table booking_private.portal_lesson_requests enable row level security;
revoke all on booking_private.portal_lesson_requests from public,anon,authenticated,service_role;

-- Private shared implementation; caller wrappers run as owner. No public helper grant.
create function booking_private.manage_lesson(p_action text,p_booking_id uuid,p_request_id uuid,
  p_slot_id uuid,p_timezone text,p_accept_credit_loss boolean)
returns jsonb language plpgsql set search_path='' as $$
declare
  s booking_private.students%rowtype; b booking_private.bookings%rowtype;
  attempt booking_private.portal_lesson_requests%rowtype;
  fp jsonb; settled jsonb; replacement jsonb; receipt jsonb;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
  if p_action is null or p_action not in ('cancel','reschedule') or p_booking_id is null
    or p_accept_credit_loss is null or p_request_id is null
    or p_request_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception using errcode='P0001',message='INVALID_REQUEST';
  end if;
  if p_action='reschedule' then
    if p_slot_id is null then raise exception using errcode='P0001',message='INVALID_SLOT'; end if;
    if p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone) then
      raise exception using errcode='P0001',message='INVALID_REQUEST';
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('portal-management-request:'||p_request_id,0));
  -- Same domain lock order as 2A/2D: student -> booking -> allocation/credit.
  select * into s from booking_private.students where auth_user_id=auth.uid() for update;
  if not found then raise exception using errcode='P0001',message='STUDENT_NOT_FOUND'; end if;
  if not public.portal_current_access() then raise exception using errcode='42501',message='PORTAL_ACCESS_DENIED'; end if;
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  fp:=jsonb_build_object('action',p_action,'student',s.id,'booking',p_booking_id,
    'slot',p_slot_id,'timezone',p_timezone,'acceptCreditLoss',p_accept_credit_loss);
  select * into attempt from booking_private.portal_lesson_requests where request_id=p_request_id;
  if found then
    if attempt.student_id<>s.id or attempt.fingerprint<>fp then
      raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT';
    end if;
    return attempt.result;
  end if;
  -- Same error for absent/other-owner/guest bookings: no ownership disclosure.
  select * into b from booking_private.bookings where id=p_booking_id and student_id=s.id for update;
  if not found then raise exception using errcode='P0001',message='BOOKING_NOT_FOUND'; end if;
  if b.status='cancelled' then raise exception using errcode='P0001',message='BOOKING_ALREADY_CANCELLED'; end if;
  if b.status<>'confirmed' or b.starts_at<=now() then
    raise exception using errcode='P0001',message='BOOKING_NOT_UPCOMING';
  end if;
  if not exists(select 1 from booking_private.credit_allocations where booking_id=b.id and status='reserved') then
    raise exception using errcode='P0001',message='BOOKING_NOT_MANAGEABLE';
  end if;
  if p_action='reschedule' and p_slot_id=b.slot_id then
    raise exception using errcode='P0001',message='SAME_SLOT';
  end if;
  -- Consent protects a confirmation opened before the 12h boundary. Business rule unchanged.
  if b.starts_at<now()+interval '12 hours' and not p_accept_credit_loss then
    raise exception using errcode='P0001',message='CREDIT_LOSS_CONFIRMATION_REQUIRED';
  end if;
  settled:=public.credit_resolve_booking(b.id,
    case when p_action='cancel' then 'student_cancel' else 'student_reschedule' end,gen_random_uuid());
  if p_action='reschedule' then
    -- This is still ONE DB transaction, never two browser/API operations.
    -- Failed availability/allocation rolls back settlement and restores the original booking.
    -- Server-generated child request IDs cannot be chosen/collided by an untrusted client.
    replacement:=public.portal_book_class(p_slot_id,gen_random_uuid(),p_timezone);
  end if;
  receipt:=jsonb_build_object('action',p_action,'bookingId',b.id,
    'status',case when p_action='cancel' then 'cancelled' else 'rescheduled' end,
    'creditOutcome',settled->>'status','replacement',replacement);
  insert into booking_private.portal_lesson_requests(request_id,student_id,booking_id,action,fingerprint,result)
    values(p_request_id,s.id,b.id,p_action,fp,receipt);
  return receipt;
end $$;
revoke all on function booking_private.manage_lesson(text,uuid,uuid,uuid,text,boolean) from public,anon,authenticated,service_role;

create function public.portal_cancel_class(p_booking_id uuid,p_request_id uuid,p_accept_credit_loss boolean default false)
returns jsonb language sql security definer set search_path='' as $$
  select booking_private.manage_lesson('cancel',p_booking_id,p_request_id,null,null,p_accept_credit_loss);
$$;
create function public.portal_reschedule_class(p_booking_id uuid,p_slot_id uuid,p_request_id uuid,
  p_timezone text,p_accept_credit_loss boolean default false)
returns jsonb language sql security definer set search_path='' as $$
  select booking_private.manage_lesson('reschedule',p_booking_id,p_request_id,p_slot_id,p_timezone,p_accept_credit_loss);
$$;
revoke all on function public.portal_cancel_class(uuid,uuid,boolean),
  public.portal_reschedule_class(uuid,uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.portal_cancel_class(uuid,uuid,boolean),
  public.portal_reschedule_class(uuid,uuid,uuid,text,boolean) to authenticated;

-- Minimal snapshot extension: own booking ID for actions, server eligibility and history label.
create or replace function public.portal_my_data()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s booking_private.students%rowtype; result jsonb;
begin
  -- Reuse the Phase 2B gate, including confirmed/matching email, bans and paid history.
  -- No student ID, email or ownership hint is accepted from the caller.
  if not public.portal_current_access() then
    raise exception using errcode='42501', message='PORTAL_ACCESS_DENIED';
  end if;
  select * into s from booking_private.students where auth_user_id=auth.uid();
  if not found then
    raise exception using errcode='42501', message='PORTAL_ACCESS_DENIED';
  end if;
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);

  with lessons as (
    select b.id,b.starts_at,b.ends_at,b.duration_minutes,b.booking_type,b.status,
      case when b.status='cancelled' and a.reason='student_reschedule' then 'rescheduled'
        when b.status='cancelled' then 'cancelled'
        when a.reason in ('completed','no_show') then a.reason
        when b.ends_at<=now() then 'past'
        else b.status end as display_status,
      b.ends_at>now() and b.status in ('pending','confirmed')
        and coalesce(a.reason,'') not in ('completed','no_show') as upcoming,
      b.status='confirmed' and b.starts_at>now() and a.status='reserved' as manageable
    from booking_private.bookings b
    left join booking_private.credit_allocations a on a.booking_id=b.id
    -- Legacy guest bookings with NULL student_id are deliberately not matched by email.
    where b.student_id=s.id
  ), lesson_rows as (
    select starts_at,upcoming,jsonb_build_object('id',id,'manageable',coalesce(manageable,false),'startsAt',starts_at,'endsAt',ends_at,
      'durationMinutes',duration_minutes,'type',booking_type,'status',display_status) as item
    from lessons
  )
  select jsonb_build_object(
    'profile',jsonb_build_object('name',s.name,'email',s.email,'language',s.contact_language,
      'country',s.country,'spanishLevel',s.spanish_level),
    'credits',public.student_credit_balances(s.id) || jsonb_build_object('nextExpiry',(
      select min(c.expires_at) from booking_private.credits c
      join booking_private.purchases p on p.id=c.purchase_id
      where p.student_id=s.id and p.status='active' and c.expires_at>now()
        and not c.requires_expiry_review
        and not exists(select 1 from booking_private.credit_allocations a
          where a.credit_id=c.id and a.status in ('reserved','consumed')))),
    'purchases',coalesce((select jsonb_agg(jsonb_build_object(
      'offer',p.offer_code,'classCount',p.credit_count,'priceMinor',p.price_minor,
      'currency',p.currency,'createdAt',p.created_at,'activatedAt',p.activated_at,
      'expiresAt',p.expires_at,'status',p.status) order by p.created_at desc,p.id)
      from booking_private.purchases p where p.student_id=s.id),'[]'::jsonb),
    'upcoming',coalesce((select jsonb_agg(item order by starts_at) from lesson_rows where upcoming),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(item order by starts_at desc) from lesson_rows where not upcoming),'[]'::jsonb)
  ) into result;
  return result;
end $$;


commit;
