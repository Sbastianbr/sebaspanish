-- Align existing RPCs with the approved 12-hour notice. Preserve permissions and all other rules.
begin;

create or replace function public.booking_available_slots(p_type text, p_plan integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o booking_private.offers%rowtype; result jsonb;
begin
  select * into o from booking_private.offers
    where code = booking_private.valid_selection(p_type, p_plan) and enabled;
  if not found then raise exception using errcode = 'P0001', message = 'INVALID_PLAN'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'startAt', to_char(a.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'endAt', to_char((a.starts_at + o.duration_minutes * interval '1 minute') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ) order by a.starts_at), '[]'::jsonb) into result
  from booking_private.availability_slots a
  where a.enabled and a.starts_at >= now() + interval '12 hours'
    and a.starts_at < now() + interval '60 days'
    and a.ends_at >= a.starts_at + o.duration_minutes * interval '1 minute'
    and not exists (select 1 from booking_private.bookings b
      where b.status in ('pending','confirmed')
        and tstzrange(b.starts_at,b.ends_at,'[)') &&
            tstzrange(a.starts_at,a.starts_at + o.duration_minutes * interval '1 minute','[)'));
  return jsonb_build_object('source','live','slots',result);
end;
$$;

create or replace function public.booking_create(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o booking_private.offers%rowtype;
  a booking_private.availability_slots%rowtype;
  b booking_private.bookings%rowtype;
  s jsonb;
  v_type text; v_plan integer; v_email text; v_timezone text;
  v_request uuid; v_slot uuid; v_fingerprint text; v_end timestamptz;
begin
  -- Reject extra fields, including browser prices, duration, status and arbitrary dates.
  if jsonb_typeof(p_payload) is distinct from 'object'
    or not (p_payload ?& array['type','plan','slotId','requestId','timezone','language','student'])
    or exists (select 1 from jsonb_object_keys(p_payload) k where k not in
      ('type','plan','slotId','requestId','timezone','language','student')) then
    raise exception using errcode='P0001', message='INVALID_REQUEST';
  end if;
  v_type := p_payload->>'type';
  if (p_payload->'plan') = 'null'::jsonb then v_plan := null;
  elsif jsonb_typeof(p_payload->'plan') = 'number' and p_payload->>'plan' in ('1','4','8') then v_plan := (p_payload->>'plan')::integer;
  else raise exception using errcode='P0001', message='INVALID_PLAN'; end if;
  select * into o from booking_private.offers
    where code = booking_private.valid_selection(v_type,v_plan) and enabled for share;
  if not found then raise exception using errcode='P0001', message='INVALID_PLAN'; end if;
  if coalesce(p_payload->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(p_payload->>'slotId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception using errcode='P0001', message='INVALID_REQUEST';
  end if;
  v_request := (p_payload->>'requestId')::uuid; v_slot := (p_payload->>'slotId')::uuid;
  v_timezone := p_payload->>'timezone';
  if not exists (select 1 from pg_timezone_names where name = v_timezone)
    or coalesce(p_payload->>'language','') not in ('es','en','pl') then
    raise exception using errcode='P0001', message='INVALID_REQUEST';
  end if;
  s := p_payload->'student';
  if jsonb_typeof(s) is distinct from 'object'
    or not (s ?& array['name','email','phone','language','country','spanishLevel','message'])
    or exists (select 1 from jsonb_each(s) e where e.key not in
      ('name','email','phone','language','country','spanishLevel','message') or jsonb_typeof(e.value) <> 'string') then
    raise exception using errcode='P0001', message='INVALID_STUDENT';
  end if;
  v_email := lower(btrim(s->>'email'));
  if length(btrim(s->>'name')) not between 1 and 100
    or length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(s->>'phone') > 40 or length(s->>'country') > 100 or length(s->>'message') > 1500
    or s->>'language' not in ('es','en','pl','other')
    or s->>'spanishLevel' not in ('','A1','A2','B1','B2','C1','C2') then
    raise exception using errcode='P0001', message='INVALID_STUDENT';
  end if;
  v_fingerprint := encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  -- Serialize identical retries, including a request that committed but lost its HTTP response.
  perform pg_advisory_xact_lock(hashtextextended('booking-request:' || v_request,0));
  select * into b from booking_private.bookings where request_id = v_request;
  if found then
    if b.request_fingerprint <> v_fingerprint then
      raise exception using errcode='P0001', message='IDEMPOTENCY_CONFLICT';
    end if;
    return booking_private.receipt(b);
  end if;
  -- Small per-email abuse limit, independent of cancellation. Not a substitute for edge anti-bot protection.
  perform pg_advisory_xact_lock(hashtextextended('booking-email:' || v_email,0));
  if (select count(*) from booking_private.bookings where student_email = v_email
      and created_at > now() - interval '1 hour') >= 5 then
    raise exception using errcode='P0001', message='RATE_LIMITED';
  end if;
  select * into a from booking_private.availability_slots where id = v_slot for share;
  v_end := a.starts_at + o.duration_minutes * interval '1 minute';
  if not found or not a.enabled or a.starts_at < now() + interval '12 hours'
    or a.starts_at >= now() + interval '60 days' or a.ends_at < v_end then
    raise exception using errcode='P0001', message='SLOT_UNAVAILABLE';
  end if;
  begin
    insert into booking_private.bookings (request_id, request_fingerprint, slot_id, offer_code,
      booking_type,plan,sessions,duration_minutes,price_minor,currency,starts_at,ends_at,timezone,
      language,student_name,student_email,student_phone,contact_language,country,spanish_level,student_message)
    values (v_request,v_fingerprint,a.id,o.code,o.booking_type,o.plan,o.sessions,o.duration_minutes,
      o.price_minor,o.currency,a.starts_at,v_end,v_timezone,p_payload->>'language',btrim(s->>'name'),
      v_email,btrim(s->>'phone'),s->>'language',btrim(s->>'country'),s->>'spanishLevel',btrim(s->>'message'))
    returning * into b;
  exception when exclusion_violation then
    raise exception using errcode='P0001', message='SLOT_UNAVAILABLE';
  end;
  return booking_private.receipt(b);
end;
$$;
commit;
