-- Phase 2C: a read-only account snapshot, always scoped to the authenticated owner.
begin;

create function public.portal_my_data()
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
    select b.starts_at,b.ends_at,b.duration_minutes,b.booking_type,b.status,
      case when b.status='cancelled' then 'cancelled'
        when a.reason in ('completed','no_show') then a.reason
        when b.ends_at<=now() then 'past'
        else b.status end as display_status,
      b.ends_at>now() and b.status in ('pending','confirmed')
        and coalesce(a.reason,'') not in ('completed','no_show') as upcoming
    from booking_private.bookings b
    left join booking_private.credit_allocations a on a.booking_id=b.id
    -- Legacy guest bookings with NULL student_id are deliberately not matched by email.
    where b.student_id=s.id
  ), lesson_rows as (
    select starts_at,upcoming,jsonb_build_object('startsAt',starts_at,'endsAt',ends_at,
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

revoke all on function public.portal_my_data() from public,anon,authenticated,service_role;
grant execute on function public.portal_my_data() to authenticated;
comment on function public.portal_my_data() is
  'Own portal data only, derived from auth.uid(); no client identity arguments or payment identifiers. Read-only; private tables remain closed.';
commit;
