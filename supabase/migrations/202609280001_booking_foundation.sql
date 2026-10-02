-- Phase 1: one teacher, explicit offered starts, UTC instants, no sample availability.
begin;
create schema if not exists booking_private;
revoke all on schema booking_private from public, anon, authenticated;

create table booking_private.offers (
  code text primary key,
  booking_type text not null check (booking_type in ('prueba', '1a1')),
  plan integer,
  sessions smallint not null check (sessions in (1, 4, 8)),
  duration_minutes smallint not null check (duration_minutes in (30, 60)),
  price_minor integer not null check (price_minor >= 0),
  currency text not null default 'PLN' check (currency = 'PLN'),
  enabled boolean not null default true,
  check ((booking_type = 'prueba' and plan is null and sessions = 1 and duration_minutes = 30)
    or (booking_type = '1a1' and plan is not null and plan in (1,4,8) and sessions = plan and duration_minutes = 60))
);
insert into booking_private.offers (code, booking_type, plan, sessions, duration_minutes, price_minor)
values ('prueba','prueba',null,1,30,0), ('1a1-1','1a1',1,1,60,6500),
       ('1a1-4','1a1',4,4,60,23000), ('1a1-8','1a1',8,8,60,44000);

-- Each row offers ONE start time; ends_at is the latest permitted end.
-- A 60-minute row can serve a 30-minute trial OR a 60-minute lesson.
create table booking_private.availability_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null unique,
  ends_at timestamptz not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours')
);

create table booking_private.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_id uuid not null unique,
  request_fingerprint text not null,
  slot_id uuid not null references booking_private.availability_slots(id),
  offer_code text not null references booking_private.offers(code),
  booking_type text not null check (booking_type in ('prueba','1a1')),
  plan integer,
  sessions smallint not null,
  duration_minutes smallint not null,
  price_minor integer not null check (price_minor >= 0),
  currency text not null check (currency = 'PLN'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  status text not null default 'confirmed' check (status in ('pending','confirmed','cancelled')),
  language text not null check (language in ('es','en','pl')),
  student_name text not null check (length(btrim(student_name)) between 1 and 100),
  student_email text not null check (length(student_email) between 3 and 254 and student_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  student_phone text not null default '' check (length(student_phone) <= 40),
  contact_language text not null check (contact_language in ('es','en','pl','other')),
  country text not null default '' check (length(country) <= 100),
  spanish_level text not null default '' check (spanish_level in ('','A1','A2','B1','B2','C1','C2')),
  student_message text not null default '' check (length(student_message) <= 1500),
  check ((booking_type = 'prueba' and plan is null and sessions = 1 and duration_minutes = 30)
    or (booking_type = '1a1' and plan is not null and plan in (1,4,8) and sessions = plan and duration_minutes = 60)),
  check (ends_at = starts_at + duration_minutes * interval '1 minute'),
  -- Stronger than UNIQUE(slot_id): also rejects different offered slots that overlap.
  constraint bookings_no_active_overlap exclude using gist
    (tstzrange(starts_at, ends_at, '[)') with &&)
    where (status in ('pending','confirmed'))
);
create index bookings_student_created_idx on booking_private.bookings (student_email, created_at);

alter table booking_private.offers enable row level security;
alter table booking_private.availability_slots enable row level security;
alter table booking_private.bookings enable row level security;
-- Deliberately NO anonymous/authenticated policies: all access is denied.
revoke all on all tables in schema booking_private from public, anon, authenticated, service_role;

-- Shared server validation. SECURITY INVOKER, private, callable only by owner functions.
create function booking_private.valid_selection(p_type text, p_plan integer)
returns text language plpgsql set search_path = '' as $$
begin
  if p_type = 'prueba' and p_plan is null then return 'prueba'; end if;
  if p_type = '1a1' and p_plan in (1,4,8) then return '1a1-' || p_plan; end if;
  raise exception using errcode = 'P0001', message = 'INVALID_PLAN';
end;
$$;

create function public.booking_available_slots(p_type text, p_plan integer)
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
  where a.enabled and a.starts_at >= now() + interval '24 hours'
    and a.starts_at < now() + interval '60 days'
    and a.ends_at >= a.starts_at + o.duration_minutes * interval '1 minute'
    and not exists (select 1 from booking_private.bookings b
      where b.status in ('pending','confirmed')
        and tstzrange(b.starts_at,b.ends_at,'[)') &&
            tstzrange(a.starts_at,a.starts_at + o.duration_minutes * interval '1 minute','[)'));
  return jsonb_build_object('source','live','slots',result);
end;
$$;

-- A receipt contains no student data. No public endpoint reads bookings by ID.
create function booking_private.receipt(b booking_private.bookings)
returns jsonb language sql immutable set search_path = '' as $$
 select jsonb_build_object('id', b.id, 'status', b.status, 'type', b.booking_type,
 'plan', b.plan, 'price', b.price_minor / 100.0, 'currency', b.currency,
 'durationMinutes', b.duration_minutes, 'sessions', b.sessions,
 'slotId', b.slot_id, 'timezone', b.timezone,
 'startAt', to_char(b.starts_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'endAt', to_char(b.ends_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
$$;

create function public.booking_create(p_payload jsonb)
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
  if not found or not a.enabled or a.starts_at < now() + interval '24 hours'
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

revoke all on all functions in schema booking_private from public, anon, authenticated, service_role;
revoke all on function public.booking_available_slots(text,integer) from public,anon,authenticated;
revoke all on function public.booking_create(jsonb) from public,anon,authenticated;
grant execute on function public.booking_available_slots(text,integer), public.booking_create(jsonb) to service_role;
commit;
