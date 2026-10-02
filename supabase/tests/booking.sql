-- Run only on a disposable LOCAL database after the migration; always rolls back.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; end $$;
create function pg_temp.expect_error(payload jsonb, expected text) returns void language plpgsql as $$
begin
  perform public.booking_create(payload);
  raise exception 'Expected %', expected;
exception when sqlstate 'P0001' then
  if sqlerrm <> expected then raise; end if;
end $$;
create function pg_temp.payload(slot uuid, plan integer default 4) returns jsonb language sql as $$
 select jsonb_build_object('type','1a1','plan',plan,'slotId',slot,'requestId',gen_random_uuid(),
 'timezone','Europe/Warsaw','language','es','student',jsonb_build_object(
 'name','SQL Test','email','sql-test@example.invalid','phone','','language','es','country','','spanishLevel','','message',''));
$$;

do $$
declare a uuid; overlap_slot uuid; adjacent uuid; disabled uuid; too_soon uuid; too_far uuid;
 payload jsonb; receipt jsonb; again jsonb; slots jsonb; count_active integer;
begin
  insert into booking_private.availability_slots(starts_at,ends_at) values
    (date_trunc('hour',now())+interval '3 days',date_trunc('hour',now())+interval '3 days 1 hour') returning id into a;
  insert into booking_private.availability_slots(starts_at,ends_at) values
    (date_trunc('hour',now())+interval '3 days 30 minutes',date_trunc('hour',now())+interval '3 days 90 minutes') returning id into overlap_slot;
  insert into booking_private.availability_slots(starts_at,ends_at) values
    (date_trunc('hour',now())+interval '3 days 1 hour',date_trunc('hour',now())+interval '3 days 2 hours') returning id into adjacent;
  insert into booking_private.availability_slots(starts_at,ends_at,enabled) values
    (now()+interval '4 days',now()+interval '4 days 1 hour',false) returning id into disabled;
  insert into booking_private.availability_slots(starts_at,ends_at) values
    (now()+interval '1 hour',now()+interval '2 hours') returning id into too_soon;
  insert into booking_private.availability_slots(starts_at,ends_at) values
    (now()+interval '70 days',now()+interval '70 days 1 hour') returning id into too_far;
  slots := public.booking_available_slots('1a1',4)->'slots';
  perform pg_temp.assert_true(jsonb_array_length(slots)=3,'only offered, enabled slots within horizon');
  payload := pg_temp.payload(a);
  receipt := public.booking_create(payload);
  perform pg_temp.assert_true(receipt->>'status'='confirmed' and (receipt->>'price')::numeric=230
    and (receipt->>'sessions')::integer=4,'confirmed booking and server price');
  perform pg_temp.assert_true(not (receipt ? 'student') and not (receipt ? 'student_email'),'receipt excludes personal data');
  again := public.booking_create(payload);
  perform pg_temp.assert_true(receipt=again,'idempotent retry returns original receipt');
  perform pg_temp.assert_true((select count(*)=1 from booking_private.bookings),'retry did not duplicate');
  perform pg_temp.expect_error(jsonb_set(payload,'{student,name}','"Changed"'),'IDEMPOTENCY_CONFLICT');
  perform pg_temp.expect_error(pg_temp.payload(a),'SLOT_UNAVAILABLE');
  perform pg_temp.expect_error(pg_temp.payload(overlap_slot),'SLOT_UNAVAILABLE');
  perform pg_temp.expect_error(pg_temp.payload(a) || '{"type":"prueba","plan":null}','SLOT_UNAVAILABLE');
  perform pg_temp.assert_true(jsonb_array_length(public.booking_available_slots('1a1',4)->'slots')=1,'occupied overlapping starts removed');
  perform public.booking_create(pg_temp.payload(adjacent,1));
  perform pg_temp.assert_true((select count(*)=2 from booking_private.bookings),'adjacent intervals allowed');
  perform pg_temp.expect_error(pg_temp.payload(disabled),'SLOT_UNAVAILABLE');
  perform pg_temp.expect_error(pg_temp.payload(too_soon),'SLOT_UNAVAILABLE');
  perform pg_temp.expect_error(pg_temp.payload(too_far),'SLOT_UNAVAILABLE');
  perform pg_temp.expect_error(pg_temp.payload(gen_random_uuid()),'SLOT_UNAVAILABLE');
  perform pg_temp.expect_error(pg_temp.payload(a,99),'INVALID_PLAN');
  perform pg_temp.expect_error(pg_temp.payload(a) || '{"type":"dele"}','INVALID_PLAN');
  perform pg_temp.expect_error(pg_temp.payload(a) || '{"price":0}','INVALID_REQUEST');
  perform pg_temp.expect_error(pg_temp.payload(a) || '{"endAt":"2099-01-01T00:00:00Z"}','INVALID_REQUEST');
  perform pg_temp.expect_error(pg_temp.payload(a) || '{"status":"cancelled"}','INVALID_REQUEST');
  perform pg_temp.expect_error(jsonb_set(pg_temp.payload(a),'{student,email}','"bad"'),'INVALID_STUDENT');
  perform pg_temp.expect_error(jsonb_set(pg_temp.payload(a),'{student,name}','""'),'INVALID_STUDENT');
  perform pg_temp.expect_error(jsonb_set(pg_temp.payload(a),'{student}', '{"name":"Test"}'),'INVALID_STUDENT');
  perform pg_temp.expect_error(pg_temp.payload(a) || '{"timezone":"Not/AZone"}','INVALID_REQUEST');
  perform pg_temp.expect_error(pg_temp.payload(a) || '{"language":"xx"}','INVALID_REQUEST');
  -- Cancelled releases availability; pending continues to hold it.
  update booking_private.bookings set status='cancelled' where id=(receipt->>'id')::uuid;
  perform pg_temp.assert_true(jsonb_array_length(public.booking_available_slots('1a1',4)->'slots')=1,'cancelled releases slot');
  payload := pg_temp.payload(a) || '{"type":"prueba","plan":null}';
  receipt := public.booking_create(payload);
  perform pg_temp.assert_true((receipt->>'price')::numeric=0 and (receipt->>'durationMinutes')::integer=30,'trial is free, 30 minutes');
  update booking_private.bookings set status='pending' where id=(receipt->>'id')::uuid;
  perform pg_temp.expect_error(pg_temp.payload(a),'SLOT_UNAVAILABLE');
end $$;

-- Catalogue values, all three UI languages, duration and basic rate limit.
do $$
declare a uuid; b uuid; payload jsonb; receipt jsonb; last_payload jsonb; n integer; expected integer;
begin
  for n in 1..5 loop
    insert into booking_private.availability_slots(starts_at,ends_at) values
      (date_trunc('hour',now()) + interval '12 days' + n*interval '2 hours',
       date_trunc('hour',now()) + interval '12 days' + n*interval '2 hours' + interval '1 hour') returning id into a;
    payload := jsonb_set(pg_temp.payload(a,case when n=1 then 1 when n=2 then 8 else 4 end),
      '{student,email}','"limit-test@example.invalid"');
    payload := jsonb_set(payload,'{language}',to_jsonb((array['es','en','pl'])[1+(n%3)]));
    receipt := public.booking_create(payload);
    expected := case when n=1 then 65 when n=2 then 440 else 230 end;
    perform pg_temp.assert_true((receipt->>'price')::numeric=expected,'authoritative catalogue prices');
    last_payload := payload;
  end loop;
  perform pg_temp.assert_true(public.booking_create(last_payload)=receipt,'retry allowed after rate limit');
  perform pg_temp.expect_error(jsonb_set(last_payload,'{requestId}',to_jsonb(gen_random_uuid())),'RATE_LIMITED');
  insert into booking_private.availability_slots(starts_at,ends_at) values
    (now()+interval '20 days',now()+interval '20 days 30 minutes') returning id into b;
  perform pg_temp.expect_error(pg_temp.payload(b),'SLOT_UNAVAILABLE');
  receipt := public.booking_create(pg_temp.payload(b) || '{"type":"prueba","plan":null}');
  perform pg_temp.assert_true((receipt->>'price')::numeric=0,'30-minute offer accepts only trial');
end $$;

-- Both RPCs enforce the approved notice boundary, not the former 24 hours.
do $$
declare early uuid; boundary uuid; later uuid; slots jsonb; result jsonb;
begin
  insert into booking_private.availability_slots(starts_at,ends_at) values
    (now()+interval '12 hours'-interval '1 millisecond',now()+interval '13 hours'-interval '1 millisecond') returning id into early;
  insert into booking_private.availability_slots(starts_at,ends_at) values
    (now()+interval '12 hours',now()+interval '13 hours') returning id into boundary;
  insert into booking_private.availability_slots(starts_at,ends_at) values
    (now()+interval '18 hours',now()+interval '19 hours') returning id into later;
  slots := public.booking_available_slots('1a1',1)->'slots';
  perform pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(slots) s where s->>'id'=early::text),'less than 12h hidden');
  perform pg_temp.assert_true(exists(select 1 from jsonb_array_elements(slots) s where s->>'id'=boundary::text),'exactly 12h visible');
  perform pg_temp.assert_true(exists(select 1 from jsonb_array_elements(slots) s where s->>'id'=later::text),'18h visible');
  perform pg_temp.expect_error(pg_temp.payload(early,1),'SLOT_UNAVAILABLE');
  result := public.booking_create(jsonb_set(pg_temp.payload(boundary,1),'{student,email}','"notice-test@example.invalid"'));
  perform pg_temp.assert_true(result->>'status'='confirmed','exactly 12h bookable');
end $$;

-- A malicious browser role cannot reach tables OR privileged RPCs.
select pg_temp.assert_true(not has_schema_privilege('anon','booking_private','USAGE'),'anon schema denied');
select pg_temp.assert_true(not has_table_privilege('authenticated','booking_private.bookings','SELECT'),'authenticated cannot read students');
select pg_temp.assert_true(not has_table_privilege('anon','booking_private.bookings','INSERT'),'anon cannot create arbitrary bookings');
select pg_temp.assert_true(not has_function_privilege('anon','public.booking_create(jsonb)','EXECUTE'),'anon RPC denied');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.booking_available_slots(text,integer)','EXECUTE'),'authenticated RPC denied');
select pg_temp.assert_true(has_function_privilege('service_role','public.booking_create(jsonb)','EXECUTE'),'edge can create via RPC');
select pg_temp.assert_true((select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='booking_private' and c.relkind='r'),'RLS on all tables');
-- Check the grants with SET ROLE too, not only their metadata.
set local role anon;
do $$ begin
  begin perform public.booking_available_slots('1a1',1); raise exception 'anon availability allowed';
  exception when insufficient_privilege then null; end;
  begin perform * from booking_private.bookings; raise exception 'anon PII allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
select public.booking_available_slots('1a1',8);
reset role;
rollback;
