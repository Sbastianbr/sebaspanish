-- Phase 2D: authenticated booking + one automatically selected credit in one transaction.
-- Existing guest RPCs, allocation/settlement functions and applied migrations stay intact.
begin;

create function public.portal_booking_slots()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='UNAUTHENTICATED';
  end if;
  if not public.portal_current_access() then
    raise exception using errcode='42501', message='PORTAL_ACCESS_DENIED';
  end if;
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  -- Reuse the existing 60-minute offer and its notice/horizon/overlap rules.
  return public.booking_available_slots('1a1',1);
end $$;

create function public.portal_book_class(p_slot_id uuid, p_request_id uuid, p_timezone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s booking_private.students%rowtype;
  a booking_private.availability_slots%rowtype;
  b booking_private.bookings%rowtype;
  v_fingerprint text; v_created jsonb; v_error text;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='UNAUTHENTICATED';
  end if;
  if p_request_id is null or p_request_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone) then
    raise exception using errcode='P0001', message='INVALID_REQUEST';
  end if;
  if p_slot_id is null then raise exception using errcode='P0001', message='INVALID_SLOT'; end if;

  -- Same namespaces as the guest and credit operations. Acquire request locks BEFORE
  -- student -> booking -> credit, matching credit_allocate / credit_resolve_booking.
  perform pg_advisory_xact_lock(hashtextextended('booking-request:'||p_request_id,0));
  perform pg_advisory_xact_lock(hashtextextended('credit-request:'||p_request_id,0));
  select * into s from booking_private.students where auth_user_id=auth.uid() for update;
  if not found then raise exception using errcode='P0001', message='STUDENT_NOT_FOUND'; end if;
  if not public.portal_current_access() then
    raise exception using errcode='42501', message='PORTAL_ACCESS_DENIED';
  end if;
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  -- Include the server-resolved owner. Never expose an existing receipt to another user.
  -- Ignore mutable profile fields so a legitimate retry survives profile changes.
  v_fingerprint := 'portal:'||encode(sha256(convert_to(jsonb_build_object(
    'student',s.id,'slot',p_slot_id,'timezone',p_timezone)::text,'UTF8')),'hex');
  select * into b from booking_private.bookings where request_id=p_request_id;
  if found then
    if b.student_id is distinct from s.id or b.request_fingerprint<>v_fingerprint then
      raise exception using errcode='P0001', message='IDEMPOTENCY_CONFLICT';
    end if;
  else
    -- Resolve useful errors before invoking unchanged server-side booking validation.
    select * into a from booking_private.availability_slots where id=p_slot_id for share;
    if not found then raise exception using errcode='P0001', message='INVALID_SLOT'; end if;
    if a.starts_at<now()+interval '12 hours' then
      raise exception using errcode='P0001', message='BOOKING_TOO_SOON';
    end if;
    v_created := public.booking_create(jsonb_build_object(
      'type','1a1','plan',1,'slotId',p_slot_id,'requestId',p_request_id,
      'timezone',p_timezone,'language',case when s.contact_language in ('es','en','pl') then s.contact_language else 'es' end,
      'student',jsonb_build_object('name',s.name,'email',s.email,'phone',s.phone,
        'language',s.contact_language,'country',s.country,'spanishLevel',s.spanish_level,'message','')));
    -- credit_allocate already implements expiry -> created_at -> ordinal -> id,
    -- checks lesson end <= effective credit expiry, and locks the selected unit.
    -- Do NOT pass a credit ID. Failure is re-raised: booking + event + allocation roll back.
    begin
      perform public.credit_allocate(s.id,(v_created->>'id')::uuid,p_request_id);
    exception when sqlstate 'P0001' then
      get stacked diagnostics v_error=message_text;
      if v_error='CREDIT_UNAVAILABLE' then
        raise exception using errcode='P0001', message='NO_AVAILABLE_CREDITS';
      end if;
      raise;
    end;
    update booking_private.bookings set request_fingerprint=v_fingerprint
      where id=(v_created->>'id')::uuid returning * into b;
  end if;
  -- Catalogue price remains an internal booking snapshot, NOT a second charge.
  -- The purchase is the paid source of truth; return only the lesson receipt.
  return jsonb_build_object('id',b.id,'status',b.status,'slotId',b.slot_id,
    'startAt',b.starts_at,'endAt',b.ends_at,'timezone',b.timezone,
    'durationMinutes',b.duration_minutes);
end $$;

-- Definer boundary is necessary to reuse owner-only domain RPCs without opening tables.
-- PostgREST verifies JWT; each entry point independently checks auth.uid and eligibility.
revoke all on function public.portal_booking_slots(),public.portal_book_class(uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.portal_booking_slots(),public.portal_book_class(uuid,uuid,text) to authenticated;
comment on function public.portal_book_class(uuid,uuid,text) is
  'One own credit-backed lesson, atomic and idempotent; owner from auth.uid only; no client credit/price/student input.';
commit;
