-- Disposable database / development only. Fixtures are isolated in one transaction.
-- Always rolls back; never modifies existing rows or calls external services.
-- Initial fixture slots are disabled and beyond the public booking horizon.
begin;
create temporary table phase2a_checks(name text);
create sequence pg_temp.fixture_clock;
create function pg_temp.ok(p_ok boolean,p_label text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %',p_label; end if;
  insert into phase2a_checks values(p_label);
end $$;
create function pg_temp.student() returns uuid language sql as $$
  select public.student_upsert(jsonb_build_object('email',gen_random_uuid()||'@example.invalid','name','Phase 2A fixture',
    'phone','','language','es','country','','spanishLevel','B1'));
$$;
create function pg_temp.purchase(s uuid,offer text default '1a1-1') returns uuid language plpgsql as $$
declare p uuid;
begin
  p := (public.purchase_prepare(s,offer,gen_random_uuid())->>'id')::uuid;
  perform public.purchase_activate(p,'phase2a-test',gen_random_uuid()::text,gen_random_uuid()::text);
  return p;
end $$;
create function pg_temp.booking(s uuid) returns uuid language plpgsql as $$
declare profile booking_private.students%rowtype; a uuid; b uuid; t timestamptz;
begin
  select * into profile from booking_private.students where id=s;
  t := date_trunc('day',now()) + interval '70 days' + nextval('pg_temp.fixture_clock')*interval '2 hours' + interval '123 milliseconds';
  insert into booking_private.availability_slots(starts_at,ends_at,enabled) values(t,t+interval '1 hour',false) returning id into a;
  insert into booking_private.bookings(request_id,request_fingerprint,slot_id,offer_code,booking_type,plan,sessions,
    duration_minutes,price_minor,currency,starts_at,ends_at,timezone,language,student_name,student_email,contact_language)
    values(gen_random_uuid(),'isolated-phase2a-fixture',a,'1a1-1','1a1',1,1,60,6500,'PLN',t,t+interval '1 hour',
      'Europe/Warsaw','es',profile.name,profile.email,'es') returning id into b;
  return b;
end $$;

do $$
declare s uuid; again uuid; profile jsonb; p uuid; result jsonb; request uuid:=gen_random_uuid();
  event_id text:=gen_random_uuid()::text; payment_id text:=gen_random_uuid()::text; c integer; code text;
begin
  profile:=jsonb_build_object('email','  Mixed.'||gen_random_uuid()||'@Example.INVALID  ','name','Original',
    'phone','','language','en','country','','spanishLevel','');
  s:=public.student_upsert(profile);
  again:=public.student_upsert(jsonb_set(profile,'{email}',to_jsonb(lower(btrim(profile->>'email')))));
  perform pg_temp.ok(s=again,'email case/whitespace normalize to one stable student');
  perform pg_temp.ok((select email=lower(btrim(profile->>'email')) from booking_private.students where id=s),'email stored normalized');
  begin
    perform public.student_upsert(profile||'{"price":0}'); raise exception 'tampered profile accepted';
  exception when sqlstate 'P0001' then if sqlerrm<>'INVALID_STUDENT' then raise; end if; end;
  perform pg_temp.ok(true,'profile rejects extra fields');
  foreach code in array array['1a1-1','1a1-4','1a1-8'] loop
    c:=substring(code from 5)::integer;
    result:=public.purchase_prepare(s,code,gen_random_uuid()); p:=(result->>'id')::uuid;
    perform pg_temp.ok((select count(*)=0 from booking_private.credits where purchase_id=p),code||' pending purchase creates no credits');
    perform pg_temp.ok((result->>'credits')::integer=c and (result->>'priceMinor')::integer=
      case c when 1 then 6500 when 4 then 23000 else 44000 end and result->>'currency'='PLN',code||' authoritative catalogue snapshot');
    result:=public.purchase_activate(p,'phase2a-test',gen_random_uuid()::text,gen_random_uuid()::text);
    perform pg_temp.ok((select count(*)=c from booking_private.credits where purchase_id=p),code||' exact credit count');
    perform pg_temp.ok((select expires_at=booking_private.six_month_expiry(activated_at) from booking_private.purchases where id=p),code||' expiry is six calendar months');
    perform pg_temp.ok((select count(*)=c from booking_private.credit_events where purchase_id=p and action='credit_granted'),code||' grants audited');
  end loop;
  foreach code in array array['prueba','dele-1'] loop
    begin perform public.purchase_prepare(s,code,gen_random_uuid()); raise exception 'invalid purchase accepted';
    exception when sqlstate 'P0001' then if sqlerrm<>'INVALID_PLAN' then raise; end if; end;
  end loop;
  perform pg_temp.ok(true,'trial and inactive DELE cannot create paid entitlements');
  result:=public.purchase_prepare(s,'1a1-4',request); p:=(result->>'id')::uuid;
  perform pg_temp.ok(result=public.purchase_prepare(s,'1a1-4',request),'purchase preparation retry is idempotent');
  begin perform public.purchase_prepare(s,'1a1-8',request); raise exception 'changed request accepted';
  exception when sqlstate 'P0001' then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise; end if; end;
  result:=public.purchase_activate(p,'phase2a-test',payment_id,event_id);
  perform pg_temp.ok(result=public.purchase_activate(p,'phase2a-test',payment_id,event_id),'same external event returns same activation');
  perform pg_temp.ok(result=public.purchase_activate(p,'phase2a-test',payment_id,event_id||'-retry'),'new event for same payment returns same purchase');
  perform pg_temp.ok((select count(*)=4 from booking_private.credits where purchase_id=p),'activation retries never mint additional credits');
  again:=(public.purchase_prepare(s,'1a1-4',gen_random_uuid())->>'id')::uuid;
  begin perform public.purchase_activate(again,'phase2a-test',payment_id,event_id||'-other'); raise exception 'payment reused';
  exception when sqlstate 'P0001' then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise; end if; end;
  begin perform public.purchase_activate(again,'phase2a-test',payment_id||'-other',event_id); raise exception 'event reused';
  exception when sqlstate 'P0001' then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise; end if; end;
  perform pg_temp.ok((select count(*)=0 from booking_private.credits where purchase_id=again),'event/payment reuse on another purchase rejected atomically');
  perform pg_temp.ok(booking_private.six_month_expiry('2026-08-31 10:00:00+02')='2027-02-28 10:00:00+01'::timestamptz,'month-end and Warsaw DST expiry');
end $$;

do $$
declare s uuid:=pg_temp.student(); p uuid; b uuid; other_b uuid; credit uuid; request uuid:=gen_random_uuid();
  result jsonb; saved_name text; other_student uuid;
begin
  p:=pg_temp.purchase(s); b:=pg_temp.booking(s); other_b:=pg_temp.booking(s);
  select id into credit from booking_private.credits where purchase_id=p;
  select student_name into saved_name from booking_private.bookings where id=b;
  result:=public.credit_allocate(s,b,request,credit);
  perform pg_temp.ok(result=public.credit_allocate(s,b,request,credit),'allocation retry keeps same receipt');
  perform pg_temp.ok(public.student_credit_balances(s)->>'available'='0' and public.student_credit_balances(s)->>'reserved'='1','reserved credit no longer available');
  begin perform public.credit_allocate(s,other_b,gen_random_uuid(),credit); raise exception 'credit double spent';
  exception when sqlstate 'P0001' then if sqlerrm<>'CREDIT_UNAVAILABLE' then raise; end if; end;
  begin
    insert into booking_private.credit_allocations(credit_id,booking_id) values(credit,other_b);
    raise exception 'unique credit guard missing';
  exception when unique_violation then null; end;
  perform pg_temp.ok(true,'database unique index rejects two active allocations for one credit');
  other_student:=pg_temp.student(); perform pg_temp.purchase(other_student);
  begin perform public.credit_allocate(other_student,other_b,gen_random_uuid()); raise exception 'wrong owner accepted';
  exception when sqlstate 'P0001' then if sqlerrm<>'INVALID_BOOKING' then raise; end if; end;
  perform pg_temp.ok(true,'cannot allocate another student credit to a booking');
  perform public.student_upsert((select jsonb_build_object('email',email,'name','Changed profile','phone','123',
    'language','pl','country','Poland','spanishLevel','C1') from booking_private.students where id=s));
  perform pg_temp.ok((select student_name=saved_name and student_id=s from booking_private.bookings where id=b),'booking historical snapshot survives profile updates');
  perform public.credit_resolve_booking(b,'student_cancel',gen_random_uuid());
  perform pg_temp.ok(public.student_credit_balances(s)->>'available'='1','returned valid credit becomes available again');
  perform public.credit_allocate(s,other_b,gen_random_uuid(),credit);
  perform pg_temp.ok((select count(*)=2 from booking_private.credit_allocations where credit_id=credit),
    'reused returned credit retains both historical booking links');
  perform pg_temp.ok((select count(*)=1 from booking_private.credit_allocations where credit_id=credit and status='reserved'),
    'reused returned credit has only one current reservation');
end $$;

do $$
declare s uuid:=pg_temp.student(); p uuid; b uuid; result jsonb; request uuid; reason text;
begin
  p:=pg_temp.purchase(s,'1a1-8');
  foreach reason in array array['student_cancel','student_reschedule'] loop
    b:=pg_temp.booking(s); perform public.credit_allocate(s,b,gen_random_uuid());
    update booking_private.bookings set starts_at=now()+interval '12 hours',ends_at=now()+interval '13 hours' where id=b;
    request:=gen_random_uuid(); result:=public.credit_resolve_booking(b,reason,request);
    perform pg_temp.ok(result->>'status'='returned',reason||' exactly 12h returns credit');
    perform pg_temp.ok(result=public.credit_resolve_booking(b,reason,request),reason||' retry is idempotent');
    begin perform public.credit_resolve_booking(b,reason,gen_random_uuid()); raise exception 'second resolution accepted';
    exception when sqlstate 'P0001' then if sqlerrm<>'ALLOCATION_ALREADY_RESOLVED' then raise; end if; end;
    b:=pg_temp.booking(s); perform public.credit_allocate(s,b,gen_random_uuid());
    update booking_private.bookings set starts_at=now()+interval '12 hours'-interval '1 millisecond',
      ends_at=now()+interval '13 hours'-interval '1 millisecond' where id=b;
    result:=public.credit_resolve_booking(b,reason,gen_random_uuid());
    perform pg_temp.ok(result->>'status'='consumed',reason||' under 12h loses credit');
    perform pg_temp.ok((select status='cancelled' from booking_private.bookings where id=b),reason||' releases original slot');
  end loop;
  b:=pg_temp.booking(s); perform public.credit_allocate(s,b,gen_random_uuid());
  begin perform public.credit_resolve_booking(b,'no_show',gen_random_uuid()); raise exception 'future no-show accepted';
  exception when sqlstate 'P0001' then if sqlerrm<>'LESSON_NOT_STARTED_OR_FINISHED' then raise; end if; end;
  update booking_private.bookings set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=b;
  result:=public.credit_resolve_booking(b,'no_show',gen_random_uuid());
  perform pg_temp.ok(result->>'status'='consumed','no-show consumes credit');
  b:=pg_temp.booking(s); perform public.credit_allocate(s,b,gen_random_uuid());
  update booking_private.bookings set starts_at=now()-interval '4 hours',ends_at=now()-interval '3 hours' where id=b;
  result:=public.credit_resolve_booking(b,'completed',gen_random_uuid());
  perform pg_temp.ok(result->>'status'='consumed','completed lesson consumes credit');
  b:=pg_temp.booking(s); perform public.credit_allocate(s,b,gen_random_uuid());
  update booking_private.bookings set starts_at=now()+interval '1 hour',ends_at=now()+interval '2 hours' where id=b;
  result:=public.credit_resolve_booking(b,'teacher_cancel',gen_random_uuid());
  perform pg_temp.ok(result->>'status'='returned','teacher cancellation under 12h returns credit');
  perform pg_temp.ok(result->>'expiresAt'=result->>'previousExpiresAt' and result->>'teacherExtensionApplied'='false','teacher return keeps original expiry when still valid');
  perform pg_temp.ok((select count(*)=7 from booking_private.credit_events where purchase_id=p and action in ('credit_returned','credit_consumed')),'all settlements have durable audit events');
end $$;

do $$
declare s uuid:=pg_temp.student(); p uuid; early uuid; late uuid; b uuid; result jsonb; retry uuid:=gen_random_uuid();
begin
  p:=pg_temp.purchase(s,'1a1-4');
  update booking_private.credits set expires_at=now() where purchase_id=p;
  perform pg_temp.ok(public.student_credit_balances(s)->>'available'='0' and public.student_credit_balances(s)->>'expired'='4','expires_at <= now excluded without cron');
  b:=pg_temp.booking(s);
  begin perform public.credit_allocate(s,b,gen_random_uuid()); raise exception 'expired credit accepted';
  exception when sqlstate 'P0001' then if sqlerrm<>'CREDIT_UNAVAILABLE' then raise; end if; end;
  perform pg_temp.ok(true,'expired credit cannot be reserved');
  early:=pg_temp.purchase(s); late:=pg_temp.purchase(s);
  update booking_private.credits set expires_at=now()+interval '90 days' where purchase_id=early;
  result:=public.credit_allocate(s,b,gen_random_uuid());
  perform pg_temp.ok((select purchase_id=early from booking_private.credits where id=(result->>'creditId')::uuid),'earliest valid credit expiry is selected first');
  update booking_private.credits set expires_at=now()-interval '1 second' where purchase_id=early;
  result:=public.credit_resolve_booking(b,'teacher_cancel',retry);
  perform pg_temp.ok(result->>'status'='returned' and result->>'requiresExpiryReview'='false','expired teacher return is immediately usable');
  perform pg_temp.ok((result->>'expiresAt')::timestamptz=((now() at time zone 'Europe/Warsaw')+interval '30 days') at time zone 'Europe/Warsaw','teacher return grants exactly 30 Warsaw calendar days, not six months');
  perform pg_temp.ok(result->>'teacherExtensionApplied'='true','teacher extension is recorded in audit receipt');
  perform pg_temp.ok(result=public.credit_resolve_booking(b,'teacher_cancel',retry),'teacher extension retry never extends again');
  perform pg_temp.ok(public.student_credit_balances(s)->>'returnedPendingReview'='0' and public.student_credit_balances(s)->>'available'='2','teacher return after expiry becomes available');
  b:=pg_temp.booking(s);
  update booking_private.credits set expires_at=(select starts_at+interval '30 minutes' from booking_private.bookings where id=b) where purchase_id=late;
  begin perform public.credit_allocate(s,b,gen_random_uuid()); raise exception 'lesson beyond expiry accepted';
  exception when sqlstate 'P0001' then if sqlerrm<>'CREDIT_UNAVAILABLE' then raise; end if; end;
  perform pg_temp.ok(true,'whole lesson must fit within credit validity');
end $$;

-- Permission checks cover schema, RLS, direct DML and every new RPC.
do $$
declare t text; role_name text; f regprocedure;
begin
  foreach t in array array['students','purchases','credits','credit_allocations','credit_events'] loop
    perform pg_temp.ok((select relrowsecurity from pg_class where oid=('booking_private.'||t)::regclass),t||' RLS enabled');
    foreach role_name in array array['anon','authenticated','service_role'] loop
      perform pg_temp.ok(not has_table_privilege(role_name,'booking_private.'||t,'SELECT,INSERT,UPDATE,DELETE'),t||' no direct table access for '||role_name);
    end loop;
  end loop;
  foreach role_name in array array['anon','authenticated'] loop
    perform pg_temp.ok(not has_schema_privilege(role_name,'booking_private','USAGE'),'private schema blocked for '||role_name);
    foreach f in array array['public.student_upsert(jsonb)'::regprocedure,'public.purchase_prepare(uuid,text,uuid)'::regprocedure,
      'public.purchase_activate(uuid,text,text,text)'::regprocedure,'public.student_credit_balances(uuid)'::regprocedure,
      'public.credit_allocate(uuid,uuid,uuid,uuid)'::regprocedure,'public.credit_resolve_booking(uuid,text,uuid)'::regprocedure] loop
      perform pg_temp.ok(not has_function_privilege(role_name,f,'EXECUTE'),f::text||' denied to '||role_name);
      perform pg_temp.ok(has_function_privilege('service_role',f,'EXECUTE'),f::text||' available to trusted backend');
    end loop;
  end loop;
end $$;
select count(*) as passed_assertions from phase2a_checks;
rollback;
select 'Phase 2A assertions completed; fixtures rolled back' as status;
