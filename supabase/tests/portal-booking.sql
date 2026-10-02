-- Development/disposable only. Everything (including Auth fixtures) rolls back.
begin;
create temporary table phase2d_checks(label text);
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'FAIL: %',label; end if;
  insert into phase2d_checks values(label);
end $$;
create function pg_temp.fails(statement text, expected text) returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'Expected %',expected;
exception when others then
  if sqlerrm<>expected then raise; end if;
  perform pg_temp.ok(true,expected);
end $$;
create function pg_temp.buy(student uuid, offer text) returns uuid language plpgsql as $$
declare p uuid;
begin
  p := (public.purchase_prepare(student,offer,gen_random_uuid())->>'id')::uuid;
  perform public.purchase_activate(p,'phase2d-only',gen_random_uuid()::text,gen_random_uuid()::text);
  return p;
end $$;

do $$
declare
  ua uuid:=gen_random_uuid(); ub uuid:=gen_random_uuid(); uc uuid:=gen_random_uuid();
  a uuid; b uuid; p uuid; pb uuid; c uuid; first_credit uuid; second_credit uuid;
  slot uuid:=gen_random_uuid(); other_slot uuid:=gen_random_uuid(); early_slot uuid:=gen_random_uuid(); far_slot uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid(); r jsonb; retry jsonb; data jsonb; total integer;
  at_time timestamptz:=date_trunc('day',now())+interval '42 days 2 hours';
  guest jsonb; guest_id uuid;
begin
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',slot,request,'UTC'),'UNAUTHENTICATED');
  a:=public.student_upsert(jsonb_build_object('email',ua||'@example.invalid','name','Phase2D A','phone','','language','es','country','','spanishLevel',''));
  b:=public.student_upsert(jsonb_build_object('email',ub||'@example.invalid','name','Phase2D B','phone','','language','pl','country','','spanishLevel',''));
  p:=pg_temp.buy(a,'1a1-8'); pb:=pg_temp.buy(b,'1a1-1');
  insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
    (ua,ua||'@example.invalid',now(),false),(ub,ub||'@example.invalid',now(),false),(uc,uc||'@example.invalid',now(),false);
  update booking_private.students set auth_user_id=case id when a then ua else ub end where id in(a,b);
  insert into booking_private.availability_slots(id,starts_at,ends_at) values
    (slot,at_time,at_time+interval '1 hour'),(other_slot,at_time+interval '3 hours',at_time+interval '4 hours'),
    (early_slot,now()+interval '11 hours',now()+interval '12 hours'),
    (far_slot,now()+interval '61 days',now()+interval '61 days 1 hour');
  perform set_config('request.jwt.claim.sub',uc::text,true);
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',slot,request,'UTC'),'STUDENT_NOT_FOUND');
  perform set_config('request.jwt.claim.sub',ua::text,true);
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',gen_random_uuid(),request,'UTC'),'INVALID_SLOT');
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',early_slot,request,'UTC'),'BOOKING_TOO_SOON');
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',far_slot,request,'UTC'),'SLOT_UNAVAILABLE');
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',slot,request,'Unknown/Zone'),'INVALID_REQUEST');

  -- Expiry first, then age, then deterministic ordinal/id. Avoid selecting an expired/review unit.
  select id into first_credit from booking_private.credits where purchase_id=p and ordinal=3;
  select id into second_credit from booking_private.credits where purchase_id=p and ordinal=2;
  update booking_private.credits set expires_at=at_time+interval '10 days',created_at=now()-interval '1 day' where purchase_id=p;
  update booking_private.credits set expires_at=at_time+interval '5 days',created_at=now()-interval '2 days' where id in(first_credit,second_credit);
  update booking_private.credits set created_at=now()-interval '3 days' where id=first_credit;
  update booking_private.credits set expires_at=now()-interval '1 second' where purchase_id=p and ordinal=1;
  update booking_private.credits set requires_expiry_review=true where purchase_id=p and ordinal=4;
  r:=public.portal_book_class(slot,request,'America/Santiago');
  perform pg_temp.ok(r->>'status'='confirmed','authenticated booking succeeds');
  perform pg_temp.ok((select student_id=a from booking_private.bookings where id=(r->>'id')::uuid),'server student binding');
  perform pg_temp.ok((select credit_id=first_credit from booking_private.credit_allocations where booking_id=(r->>'id')::uuid),'earliest expiry then oldest credit');
  perform pg_temp.ok((select count(*)=1 from booking_private.credit_events where booking_id=(r->>'id')::uuid and action='credit_reserved'),'one audit event');
  perform pg_temp.ok(not r ?| array['email','studentId','creditId','price','purchaseId'],'receipt excludes private/payment metadata');
  update booking_private.students set name='Updated profile' where id=a;
  retry:=public.portal_book_class(slot,request,'America/Santiago');
  perform pg_temp.ok(retry=r,'exact retry after profile change');
  perform pg_temp.ok((select count(*)=1 from booking_private.bookings where request_id=request),'one booking on retry');
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',other_slot,request,'America/Santiago'),'IDEMPOTENCY_CONFLICT');
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',slot,request,'UTC'),'IDEMPOTENCY_CONFLICT');
  data:=public.portal_my_data();
  perform pg_temp.ok(jsonb_array_length(data->'upcoming')=1,'portal immediately includes new lesson');
  perform pg_temp.ok((data->'credits'->>'reserved')::integer=1,'portal credit balance updated');

  perform set_config('request.jwt.claim.sub',ub::text,true);
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',slot,request,'America/Santiago'),'IDEMPOTENCY_CONFLICT');
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',slot,gen_random_uuid(),'UTC'),'SLOT_UNAVAILABLE');
  perform pg_temp.ok((public.student_credit_balances(b)->>'available')::integer=1,'slot loser retains credit');
  perform pg_temp.ok(jsonb_array_length(public.portal_my_data()->'upcoming')=0,'other student cannot see booking');
  update booking_private.credits set expires_at=now()-interval '1 second' where purchase_id=pb;
  total:=(select count(*) from booking_private.bookings);
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',other_slot,gen_random_uuid(),'UTC'),'NO_AVAILABLE_CREDITS');
  perform pg_temp.ok((select count(*)=total from booking_private.bookings),'failed allocation rolls back booking');
  perform pg_temp.ok(not exists(select 1 from booking_private.credit_allocations x join booking_private.credits y on x.credit_id=y.id where y.purchase_id=pb),'no allocation after failure');
  update booking_private.credits set expires_at=at_time+interval '3 hours 30 minutes' where purchase_id=pb;
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',other_slot,gen_random_uuid(),'UTC'),'NO_AVAILABLE_CREDITS');
  update booking_private.credits set expires_at=at_time+interval '10 days' where purchase_id=pb;
  perform public.portal_book_class(other_slot,gen_random_uuid(),'UTC');
  perform pg_temp.ok((public.student_credit_balances(b)->>'available')::integer=0,'single credit exhausted');
  perform public.credit_resolve_booking((r->>'id')::uuid,'student_cancel',gen_random_uuid());
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',slot,gen_random_uuid(),'UTC'),'NO_AVAILABLE_CREDITS');
  perform set_config('request.jwt.claim.sub',ua::text,true);
  perform pg_temp.ok((select status='returned' from booking_private.credit_allocations where booking_id=(r->>'id')::uuid),'early cancellation still returns credit');
  retry:=public.portal_book_class(slot,request,'America/Santiago');
  perform pg_temp.ok(retry->>'id'=r->>'id' and retry->>'status'='cancelled','retry does not recreate cancelled class');

  -- Legacy public backend creation stays independent: no inferred student by matching email.
  guest:=jsonb_build_object('type','1a1','plan',4,'slotId',slot,'requestId',gen_random_uuid(),'timezone','UTC','language','es',
    'student',jsonb_build_object('name','Guest','email',ua||'@example.invalid','phone','','language','es','country','','spanishLevel','','message',''));
  guest_id:=(public.booking_create(guest)->>'id')::uuid;
  perform pg_temp.ok((select student_id is null and price_minor=23000 from booking_private.bookings where id=guest_id),'guest price and nullable identity unchanged');
  perform pg_temp.ok(not exists(select 1 from booking_private.credit_allocations where booking_id=guest_id),'guest does not allocate credit');
  perform pg_temp.fails(format('select public.portal_book_class(%L,%L,%L)',slot,guest->>'requestId','UTC'),'IDEMPOTENCY_CONFLICT');
end $$;

do $$
declare fn text; role_name text; tbl text;
begin
  foreach fn in array array['public.portal_booking_slots()','public.portal_book_class(uuid,uuid,text)'] loop
    perform pg_temp.ok(has_function_privilege('authenticated',fn,'EXECUTE'),'authenticated RPC grant');
    foreach role_name in array array['anon','service_role'] loop
      perform pg_temp.ok(not has_function_privilege(role_name,fn,'EXECUTE'),'no RPC grant to '||role_name);
    end loop;
  end loop;
  foreach tbl in array array['students','purchases','credits','credit_allocations','credit_events'] loop
    perform pg_temp.ok((select relrowsecurity from pg_class where oid=('booking_private.'||tbl)::regclass),'RLS preserved '||tbl);
    perform pg_temp.ok(not has_table_privilege('authenticated','booking_private.'||tbl,'SELECT,INSERT,UPDATE,DELETE'),'no direct access '||tbl);
  end loop;
end $$;
select count(*) as assertions_passed from phase2d_checks;
rollback;
