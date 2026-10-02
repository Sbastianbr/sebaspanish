-- Phase 2A: private domain foundation. Existing booking RPCs stay unchanged.
begin;

create table booking_private.students (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and length(email) <= 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  name text not null check (length(btrim(name)) between 1 and 100),
  phone text not null default '' check (length(phone) <= 40),
  contact_language text not null check (contact_language in ('es','en','pl','other')),
  country text not null default '' check (length(country) <= 100),
  spanish_level text not null default '' check (spanish_level in ('','A1','A2','B1','B2','C1','C2')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Nullable bridge: legacy/guest bookings need neither a student nor credits.
-- Existing contact columns remain immutable historical snapshots in domain operations.
alter table booking_private.bookings add column student_id uuid references booking_private.students(id);
create index bookings_student_id_idx on booking_private.bookings(student_id) where student_id is not null;

create table booking_private.purchases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references booking_private.students(id),
  offer_code text not null references booking_private.offers(code),
  booking_type text not null,
  price_minor integer not null check (price_minor > 0),
  currency text not null check (currency = 'PLN'),
  credit_count smallint not null check (credit_count in (1,4,8)),
  duration_minutes smallint not null check (duration_minutes = 60),
  status text not null default 'pending' check (status in ('pending','active')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz,
  external_source text,
  external_payment_id text,
  unique (external_source, external_payment_id),
  check ((status = 'pending' and activated_at is null and expires_at is null
    and external_source is null and external_payment_id is null)
    or (status = 'active' and activated_at is not null and expires_at is not null and expires_at > activated_at
      and external_source is not null and external_payment_id is not null)),
  check (external_source is null or length(btrim(external_source)) between 1 and 64),
  check (external_payment_id is null or length(btrim(external_payment_id)) between 1 and 255)
);
create index purchases_student_idx on booking_private.purchases(student_id,created_at);

-- Individual entitlements; no mutable remaining_credits counter.
create table booking_private.credits (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references booking_private.purchases(id),
  ordinal smallint not null check (ordinal between 1 and 8),
  expires_at timestamptz not null,
  requires_expiry_review boolean not null default false,
  created_at timestamptz not null default now(),
  unique (purchase_id, ordinal)
);
create index credits_expiry_idx on booking_private.credits(expires_at,id);

-- Returned allocations remain here, so historical booking <-> credit is never lost.
create table booking_private.credit_allocations (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references booking_private.credits(id),
  booking_id uuid not null unique references booking_private.bookings(id),
  status text not null default 'reserved' check (status in ('reserved','consumed','returned')),
  reserved_at timestamptz not null default now(),
  resolved_at timestamptz,
  reason text,
  check ((status = 'reserved' and resolved_at is null and reason is null)
    or (status in ('consumed','returned') and resolved_at is not null and reason is not null and reason in
      ('completed','no_show','student_cancel','student_reschedule','teacher_cancel')))
);
-- Final database guard, even if a caller misses an application-level check.
create unique index credit_one_active_allocation on booking_private.credit_allocations(credit_id)
  where status in ('reserved','consumed');

-- Append-only via authorized RPCs: domain history and idempotent operation receipts.
-- Public/service roles have no direct DML; no RPC edits/deletes these entries.
create table booking_private.credit_events (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references booking_private.purchases(id),
  credit_id uuid references booking_private.credits(id),
  booking_id uuid references booking_private.bookings(id),
  action text not null check (action in ('purchase_created','purchase_activated','credit_granted',
    'credit_reserved','credit_returned','credit_consumed')),
  request_id uuid unique,
  external_source text,
  external_event_id text,
  fingerprint jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (external_source,external_event_id),
  check ((external_source is null) = (external_event_id is null)),
  check (external_source is null or length(btrim(external_source)) between 1 and 64),
  check (external_event_id is null or length(btrim(external_event_id)) between 1 and 255)
);
create index credit_events_credit_idx on booking_private.credit_events(credit_id,created_at);
create index credit_events_purchase_idx on booking_private.credit_events(purchase_id,created_at);
create index credit_events_booking_idx on booking_private.credit_events(booking_id) where booking_id is not null;

alter table booking_private.students enable row level security;
alter table booking_private.purchases enable row level security;
alter table booking_private.credits enable row level security;
alter table booking_private.credit_allocations enable row level security;
alter table booking_private.credit_events enable row level security;
revoke all on booking_private.students, booking_private.purchases, booking_private.credits,
  booking_private.credit_allocations, booking_private.credit_events from public,anon,authenticated,service_role;

create function booking_private.six_month_expiry(p_activated_at timestamptz)
returns timestamptz language sql stable set search_path = '' as $$
  select ((p_activated_at at time zone 'Europe/Warsaw') + interval '6 months') at time zone 'Europe/Warsaw';
$$;

-- Server-only profile upsert. Email is an identifier, NOT proof of ownership.
create function public.student_upsert(p_profile jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_email text;
begin
  if jsonb_typeof(p_profile) is distinct from 'object'
    or not (p_profile ?& array['email','name','phone','language','country','spanishLevel'])
    or exists(select 1 from jsonb_each(p_profile) e where e.key not in
      ('email','name','phone','language','country','spanishLevel') or jsonb_typeof(e.value) <> 'string') then
    raise exception using errcode='P0001',message='INVALID_STUDENT';
  end if;
  v_email := lower(btrim(p_profile->>'email'));
  if length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(btrim(p_profile->>'name')) not between 1 and 100
    or length(p_profile->>'phone')>40 or length(p_profile->>'country')>100
    or p_profile->>'language' not in ('es','en','pl','other')
    or p_profile->>'spanishLevel' not in ('','A1','A2','B1','B2','C1','C2') then
    raise exception using errcode='P0001',message='INVALID_STUDENT';
  end if;
  insert into booking_private.students(email,name,phone,contact_language,country,spanish_level)
    values(v_email,btrim(p_profile->>'name'),btrim(p_profile->>'phone'),p_profile->>'language',
      btrim(p_profile->>'country'),p_profile->>'spanishLevel')
  on conflict(email) do update set name=excluded.name,phone=excluded.phone,
    contact_language=excluded.contact_language,country=excluded.country,
    spanish_level=excluded.spanish_level,updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

create function public.purchase_prepare(p_student_id uuid,p_offer_code text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o booking_private.offers%rowtype; p booking_private.purchases%rowtype;
  e booking_private.credit_events%rowtype; fp jsonb; result jsonb;
begin
  if p_request_id is null or p_student_id is null or p_offer_code is null then
    raise exception using errcode='P0001',message='INVALID_REQUEST';
  end if;
  fp := jsonb_build_object('action','purchase_created','studentId',p_student_id,'offerCode',p_offer_code);
  perform pg_advisory_xact_lock(hashtextextended('credit-request:'||p_request_id,0));
  select * into e from booking_private.credit_events where request_id=p_request_id;
  if found then
    if e.fingerprint <> fp then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    return e.result;
  end if;
  perform 1 from booking_private.students where id=p_student_id;
  if not found then raise exception using errcode='P0001',message='INVALID_STUDENT'; end if;
  select * into o from booking_private.offers where code=p_offer_code and enabled and booking_type='1a1' for share;
  if not found then raise exception using errcode='P0001',message='INVALID_PLAN'; end if;
  insert into booking_private.purchases(student_id,offer_code,booking_type,price_minor,currency,credit_count,duration_minutes)
    values(p_student_id,o.code,o.booking_type,o.price_minor,o.currency,o.sessions,o.duration_minutes) returning * into p;
  result := jsonb_build_object('id',p.id,'status',p.status,'priceMinor',p.price_minor,'currency',p.currency,
    'credits',p.credit_count,'durationMinutes',p.duration_minutes);
  insert into booking_private.credit_events(purchase_id,action,request_id,fingerprint,result)
    values(p.id,'purchase_created',p_request_id,fp,result);
  return result;
end;
$$;

-- Future verified webhook calls this. It does NOT verify or collect a payment itself.
-- Amount/time/credit count are never inputs. A purchase snapshot comes from the server catalogue.
create function public.purchase_activate(p_purchase_id uuid,p_external_source text,
  p_external_payment_id text,p_external_event_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p booking_private.purchases%rowtype; e booking_private.credit_events%rowtype;
  c booking_private.credits%rowtype; fp jsonb; result jsonb; v_source text;
begin
  v_source := lower(btrim(p_external_source));
  if p_purchase_id is null or v_source is null or length(v_source) not between 1 and 64
    or p_external_payment_id is null or length(btrim(p_external_payment_id)) not between 1 and 255
    or p_external_event_id is null or length(btrim(p_external_event_id)) not between 1 and 255
    or p_external_payment_id <> btrim(p_external_payment_id) or p_external_event_id <> btrim(p_external_event_id) then
    raise exception using errcode='P0001',message='INVALID_REQUEST';
  end if;
  fp := jsonb_build_object('purchaseId',p_purchase_id,'source',v_source,'paymentId',p_external_payment_id);
  perform pg_advisory_xact_lock(hashtextextended('credit-event:'||jsonb_build_array(v_source,p_external_event_id)::text,0));
  select * into e from booking_private.credit_events where external_source=v_source and external_event_id=p_external_event_id;
  if found then
    if e.fingerprint <> fp then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    return e.result;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('credit-payment:'||jsonb_build_array(v_source,p_external_payment_id)::text,0));
  if exists(select 1 from booking_private.purchases where external_source=v_source
    and external_payment_id=p_external_payment_id and id<>p_purchase_id) then
    raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT';
  end if;
  select * into p from booking_private.purchases where id=p_purchase_id for update;
  if not found then raise exception using errcode='P0001',message='INVALID_PURCHASE'; end if;
  if p.status='active' then
    if p.external_source<>v_source or p.external_payment_id<>p_external_payment_id then
      raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT';
    end if;
  else
    update booking_private.purchases set status='active',activated_at=now(),
      expires_at=booking_private.six_month_expiry(now()),external_source=v_source,external_payment_id=p_external_payment_id
      where id=p.id returning * into p;
    for c in insert into booking_private.credits(purchase_id,ordinal,expires_at)
      select p.id,n,p.expires_at from generate_series(1,p.credit_count) n returning * loop
      insert into booking_private.credit_events(purchase_id,credit_id,action,fingerprint,result)
        values(p.id,c.id,'credit_granted','{}',jsonb_build_object('creditId',c.id,'expiresAt',c.expires_at));
    end loop;
  end if;
  result := jsonb_build_object('id',p.id,'status',p.status,'credits',p.credit_count,
    'priceMinor',p.price_minor,'currency',p.currency,'activatedAt',p.activated_at,'expiresAt',p.expires_at);
  insert into booking_private.credit_events(purchase_id,action,external_source,external_event_id,fingerprint,result)
    values(p.id,'purchase_activated',v_source,p_external_event_id,fp,result);
  return result;
end;
$$;

-- Effective expiry is evaluated at query time: no cron needed.
create function public.student_credit_balances(p_student_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with units as (
    select c.id, case when a.status='consumed' then 'consumed'
      when a.status='reserved' then 'reserved'
      when c.requires_expiry_review then 'returned_pending_review'
      when c.expires_at<=now() then 'expired' else 'available' end as state
    from booking_private.credits c join booking_private.purchases p on p.id=c.purchase_id
    left join booking_private.credit_allocations a on a.credit_id=c.id and a.status in ('reserved','consumed')
    where p.student_id=p_student_id and p.status='active'
  ) select jsonb_build_object('available',count(*) filter(where state='available'),
    'reserved',count(*) filter(where state='reserved'),'consumed',count(*) filter(where state='consumed'),
    'expired',count(*) filter(where state='expired'),'returnedPendingReview',count(*) filter(where state='returned_pending_review'),
    'total',count(*)) from units;
$$;

-- Internal transition bridge. A future authenticated booking transaction can call it
-- after creating a booking, in that SAME transaction. Phase 1 never calls it.
create function public.credit_allocate(p_student_id uuid,p_booking_id uuid,p_request_id uuid,p_credit_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b booking_private.bookings%rowtype; c booking_private.credits%rowtype;
  a booking_private.credit_allocations%rowtype; e booking_private.credit_events%rowtype;
  fp jsonb; result jsonb; v_email text;
begin
  if p_request_id is null or p_student_id is null or p_booking_id is null then
    raise exception using errcode='P0001',message='INVALID_REQUEST';
  end if;
  fp := jsonb_build_object('action','credit_reserved','studentId',p_student_id,'bookingId',p_booking_id,'creditId',p_credit_id);
  perform pg_advisory_xact_lock(hashtextextended('credit-request:'||p_request_id,0));
  select * into e from booking_private.credit_events where request_id=p_request_id;
  if found then
    if e.fingerprint<>fp then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    return e.result;
  end if;
  -- Shared lock order for allocation/settlement: student -> booking -> credit.
  select email into v_email from booking_private.students where id=p_student_id for update;
  if not found then raise exception using errcode='P0001',message='INVALID_STUDENT'; end if;
  select * into b from booking_private.bookings where id=p_booking_id for update;
  if not found or b.status<>'confirmed' or b.booking_type<>'1a1' or b.starts_at<now()+interval '12 hours'
    or lower(btrim(b.student_email))<>v_email or (b.student_id is not null and b.student_id<>p_student_id) then
    raise exception using errcode='P0001',message='INVALID_BOOKING';
  end if;
  if exists(select 1 from booking_private.credit_allocations where booking_id=b.id) then
    raise exception using errcode='P0001',message='BOOKING_ALREADY_ALLOCATED';
  end if;
  select c0.* into c from booking_private.credits c0 join booking_private.purchases p on p.id=c0.purchase_id
    where p.student_id=p_student_id and p.status='active' and p.booking_type=b.booking_type
      and p.duration_minutes=b.duration_minutes and c0.expires_at>now() and b.ends_at<=c0.expires_at
      and not c0.requires_expiry_review and (p_credit_id is null or c0.id=p_credit_id)
      and not exists(select 1 from booking_private.credit_allocations a0 where a0.credit_id=c0.id and a0.status in ('reserved','consumed'))
    order by c0.expires_at,c0.created_at,c0.ordinal,c0.id limit 1 for update of c0;
  if not found then raise exception using errcode='P0001',message='CREDIT_UNAVAILABLE'; end if;
  insert into booking_private.credit_allocations(credit_id,booking_id) values(c.id,b.id) returning * into a;
  update booking_private.bookings set student_id=p_student_id where id=b.id;
  result := jsonb_build_object('allocationId',a.id,'creditId',c.id,'bookingId',b.id,'status',a.status);
  insert into booking_private.credit_events(purchase_id,credit_id,booking_id,action,request_id,fingerprint,result)
    values(c.purchase_id,c.id,b.id,'credit_reserved',p_request_id,fp,result);
  return result;
end;
$$;

create function public.credit_resolve_booking(p_booking_id uuid,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b booking_private.bookings%rowtype; c booking_private.credits%rowtype;
  a booking_private.credit_allocations%rowtype; e booking_private.credit_events%rowtype;
  v_student uuid; v_return boolean; v_review boolean; fp jsonb; result jsonb;
begin
  if p_request_id is null or p_booking_id is null or p_reason is null or p_reason not in
    ('completed','no_show','student_cancel','student_reschedule','teacher_cancel') then
    raise exception using errcode='P0001',message='INVALID_REQUEST';
  end if;
  fp := jsonb_build_object('action','resolve','bookingId',p_booking_id,'reason',p_reason);
  perform pg_advisory_xact_lock(hashtextextended('credit-request:'||p_request_id,0));
  select * into e from booking_private.credit_events where request_id=p_request_id;
  if found then
    if e.fingerprint<>fp then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    return e.result;
  end if;
  select p.student_id into v_student from booking_private.credit_allocations a0
    join booking_private.credits c0 on c0.id=a0.credit_id join booking_private.purchases p on p.id=c0.purchase_id
    where a0.booking_id=p_booking_id;
  if not found then raise exception using errcode='P0001',message='ALLOCATION_NOT_FOUND'; end if;
  perform 1 from booking_private.students where id=v_student for update;
  select * into b from booking_private.bookings where id=p_booking_id for update;
  select * into a from booking_private.credit_allocations where booking_id=b.id for update;
  if a.status<>'reserved' or b.status<>'confirmed' then
    raise exception using errcode='P0001',message='ALLOCATION_ALREADY_RESOLVED';
  end if;
  if (p_reason='completed' and b.ends_at>now()) or (p_reason='no_show' and b.starts_at>now()) then
    raise exception using errcode='P0001',message='LESSON_NOT_STARTED_OR_FINISHED';
  end if;
  select * into c from booking_private.credits where id=a.credit_id for update;
  v_return := p_reason='teacher_cancel' or
    (p_reason in ('student_cancel','student_reschedule') and b.starts_at>=now()+interval '12 hours');
  -- Never silently lose a teacher-restored credit after expiry. Preserve it for an
  -- explicit administrative extension later; do not invent a new validity period.
  v_review := v_return and p_reason='teacher_cancel' and c.expires_at<=now();
  update booking_private.credit_allocations set status=case when v_return then 'returned' else 'consumed' end,
    resolved_at=now(),reason=p_reason where id=a.id returning * into a;
  if v_review then update booking_private.credits set requires_expiry_review=true where id=c.id; end if;
  if p_reason in ('student_cancel','student_reschedule','teacher_cancel') then
    update booking_private.bookings set status='cancelled' where id=b.id;
  end if;
  result := jsonb_build_object('allocationId',a.id,'creditId',c.id,'bookingId',b.id,'status',a.status,
    'reason',p_reason,'requiresExpiryReview',v_review);
  insert into booking_private.credit_events(purchase_id,credit_id,booking_id,action,request_id,fingerprint,result)
    values(c.purchase_id,c.id,b.id,case when v_return then 'credit_returned' else 'credit_consumed' end,p_request_id,fp,result);
  return result;
end;
$$;

revoke all on function booking_private.six_month_expiry(timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.student_upsert(jsonb),public.purchase_prepare(uuid,text,uuid),
  public.purchase_activate(uuid,text,text,text),public.student_credit_balances(uuid),
  public.credit_allocate(uuid,uuid,uuid,uuid),public.credit_resolve_booking(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.student_upsert(jsonb),public.purchase_prepare(uuid,text,uuid),
  public.purchase_activate(uuid,text,text,text),public.student_credit_balances(uuid),
  public.credit_allocate(uuid,uuid,uuid,uuid),public.credit_resolve_booking(uuid,text,uuid) to service_role;
commit;
