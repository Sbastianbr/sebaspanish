-- Development/disposable only; all fixtures and test helpers roll back.
begin;
create temporary table phase2e_checks(label text);
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label;end if;
insert into phase2e_checks values(label);end $$;
create function pg_temp.fails(statement text,expected text) returns void language plpgsql as $$
begin execute statement;raise exception 'Expected %',expected;
exception when others then if sqlerrm<>expected then raise;end if;perform pg_temp.ok(true,expected);end $$;
create sequence pg_temp.phase2e_clock;
create function pg_temp.slot() returns uuid language plpgsql as $$
declare id uuid; at_time timestamptz:=date_trunc('day',now())+interval '31 days 00:03'+nextval('pg_temp.phase2e_clock')*interval '2 hours';
begin insert into booking_private.availability_slots(starts_at,ends_at) values(at_time,at_time+interval '1 hour') returning availability_slots.id into id;return id;end $$;
create function pg_temp.student(offer text) returns uuid language plpgsql as $$
declare u uuid:=gen_random_uuid(); s uuid; p uuid;
begin
 s:=public.student_upsert(jsonb_build_object('email',u||'@example.invalid','name','Phase2E SQL','language','es','phone','','country','','spanishLevel',''));
 insert into auth.users(id,email,email_confirmed_at,is_anonymous) values(u,u||'@example.invalid',now(),false);
 update booking_private.students set auth_user_id=u where id=s;
 p:=(public.purchase_prepare(s,offer,gen_random_uuid())->>'id')::uuid;
 perform public.purchase_activate(p,'phase2e-sql',gen_random_uuid()::text,gen_random_uuid()::text);
 return s;
end $$;
create function pg_temp.login(s uuid) returns void language sql as $$
 select set_config('request.jwt.claim.sub',(select auth_user_id::text from booking_private.students where id=s),true)::text is not null;
$$;
create function pg_temp.book(s uuid) returns uuid language plpgsql as $$
declare b uuid;begin
 perform pg_temp.login(s);b:=(public.portal_book_class(pg_temp.slot(),gen_random_uuid(),'UTC')->>'id')::uuid;
 -- Only test fixtures are aged to exercise many cases independently of the existing per-hour limit.
 update booking_private.bookings set created_at=now()-interval '2 hours' where id=b;return b;
end $$;
do $$
declare a uuid:=pg_temp.student('1a1-8'); other_student uuid:=pg_temp.student('1a1-1');
 b uuid; other_booking uuid; req uuid; r jsonb; slot uuid; old_credit uuid; n integer;
begin
 b:=pg_temp.book(a);req:=gen_random_uuid();
 update booking_private.bookings set starts_at=now()+interval '12 hours',ends_at=now()+interval '13 hours' where id=b;
 r:=public.portal_cancel_class(b,req);
 perform pg_temp.ok(r->>'creditOutcome'='returned','exact 12h cancellation returns credit');
 perform pg_temp.ok(public.portal_cancel_class(b,req)=r,'cancel retry exact receipt');
 perform pg_temp.ok((select count(*)=1 from booking_private.portal_lesson_requests where request_id=req),'one action receipt');
 perform pg_temp.ok((select count(*)=1 from booking_private.credit_events where booking_id=b and action='credit_returned'),'one return event');
 perform pg_temp.fails(format('select public.portal_cancel_class(%L,%L)',b,gen_random_uuid()),'BOOKING_ALREADY_CANCELLED');
 perform pg_temp.fails(format('select public.portal_cancel_class(%L,%L,true)',b,req),'IDEMPOTENCY_CONFLICT');
 b:=pg_temp.book(a);update booking_private.bookings set starts_at=now()+interval '11 hours',ends_at=now()+interval '12 hours' where id=b;
 perform pg_temp.fails(format('select public.portal_cancel_class(%L,%L)',b,gen_random_uuid()),'CREDIT_LOSS_CONFIRMATION_REQUIRED');
 perform pg_temp.ok((select status='confirmed' from booking_private.bookings where id=b),'threshold change does not cancel silently');
 r:=public.portal_cancel_class(b,gen_random_uuid(),true);
 perform pg_temp.ok(r->>'creditOutcome'='consumed','late cancellation consumes original credit');
 other_booking:=pg_temp.book(other_student);perform pg_temp.login(a);
 perform pg_temp.fails(format('select public.portal_cancel_class(%L,%L)',other_booking,gen_random_uuid()),'BOOKING_NOT_FOUND');
 perform pg_temp.fails(format('select public.portal_reschedule_class(%L,%L,%L,%L)',other_booking,pg_temp.slot(),gen_random_uuid(),'UTC'),'BOOKING_NOT_FOUND');
 b:=pg_temp.book(a);slot:=pg_temp.slot();req:=gen_random_uuid();
 r:=public.portal_reschedule_class(b,slot,req,'Europe/Warsaw');
 perform pg_temp.ok(r->>'status'='rescheduled' and r->>'creditOutcome'='returned','early change succeeds');
 perform pg_temp.ok((select status='cancelled' from booking_private.bookings where id=b),'old booking released');
 perform pg_temp.ok((select student_id=a and status='confirmed' from booking_private.bookings where id=(r#>>'{replacement,id}')::uuid),'replacement belongs to same student');
 perform pg_temp.ok(public.portal_reschedule_class(b,slot,req,'Europe/Warsaw')=r,'reschedule retry exact receipt');
 perform pg_temp.fails(format('select public.portal_reschedule_class(%L,%L,%L,%L)',b,pg_temp.slot(),req,'Europe/Warsaw'),'IDEMPOTENCY_CONFLICT');
 perform pg_temp.ok(exists(select 1 from jsonb_array_elements(public.portal_my_data()->'history') x where x->>'id'=b::text and x->>'status'='rescheduled'),'history marks original rescheduled');
 perform pg_temp.ok(exists(select 1 from jsonb_array_elements(public.portal_my_data()->'upcoming') x where x->>'id'=r#>>'{replacement,id}' and (x->>'manageable')::boolean),'new class manageable in portal');
 -- An occupied target reverses settlement, credit event and original status.
 b:=pg_temp.book(a);select credit_id into old_credit from booking_private.credit_allocations where booking_id=b;
 select slot_id into slot from booking_private.bookings where id=other_booking;
 select count(*) into n from booking_private.credit_events where booking_id=b;
 perform pg_temp.fails(format('select public.portal_reschedule_class(%L,%L,%L,%L)',b,slot,gen_random_uuid(),'UTC'),'SLOT_UNAVAILABLE');
 perform pg_temp.ok((select status='confirmed' from booking_private.bookings where id=b),'occupied target preserves old booking');
 perform pg_temp.ok((select status='reserved' and credit_id=old_credit from booking_private.credit_allocations where booking_id=b),'occupied target preserves exact allocation');
 perform pg_temp.ok((select count(*)=n from booking_private.credit_events where booking_id=b),'no audit event on failed move');
 -- A late change needs an additional unit; early returns remain expiry-limited.
 perform pg_temp.login(other_student);
 update booking_private.bookings set starts_at=now()+interval '11 hours',ends_at=now()+interval '12 hours' where id=other_booking;
 perform pg_temp.fails(format('select public.portal_reschedule_class(%L,%L,%L,%L,true)',other_booking,pg_temp.slot(),gen_random_uuid(),'UTC'),'NO_AVAILABLE_CREDITS');
 perform pg_temp.ok((select status='confirmed' from booking_private.bookings where id=other_booking),'no extra credit preserves original late booking');
 perform pg_temp.ok((select status='reserved' from booking_private.credit_allocations where booking_id=other_booking),'no extra credit does not consume original');
 update booking_private.bookings set starts_at=now()+interval '13 hours',ends_at=now()+interval '14 hours' where id=other_booking;
 update booking_private.credits set expires_at=now()+interval '20 hours' where id in(select credit_id from booking_private.credit_allocations where booking_id=other_booking);
 perform pg_temp.fails(format('select public.portal_reschedule_class(%L,%L,%L,%L)',other_booking,pg_temp.slot(),gen_random_uuid(),'UTC'),'NO_AVAILABLE_CREDITS');
 perform pg_temp.ok((select status='confirmed' from booking_private.bookings where id=other_booking),'expiry failure preserves original');
 perform pg_temp.login(a);
 b:=pg_temp.book(a);update booking_private.bookings set starts_at=now()+interval '10 hours',ends_at=now()+interval '11 hours' where id=b;
 r:=public.portal_reschedule_class(b,pg_temp.slot(),gen_random_uuid(),'UTC',true);
 perform pg_temp.ok(r->>'creditOutcome'='consumed','late move consumes old unit');
 perform pg_temp.ok((select old.credit_id<>new.credit_id from booking_private.credit_allocations old join booking_private.credit_allocations new on new.booking_id=(r#>>'{replacement,id}')::uuid where old.booking_id=b),'late move reserves another unit');
 perform set_config('request.jwt.claim.sub','',true);
 perform pg_temp.fails(format('select public.portal_cancel_class(%L,%L)',b,gen_random_uuid()),'UNAUTHENTICATED');
end $$;
do $$
declare f regprocedure; role_name text;
begin
 foreach f in array array['public.portal_cancel_class(uuid,uuid,boolean)'::regprocedure,'public.portal_reschedule_class(uuid,uuid,uuid,text,boolean)'::regprocedure] loop
  perform pg_temp.ok(has_function_privilege('authenticated',f,'EXECUTE'),'authenticated allowed');
  foreach role_name in array array['anon','service_role'] loop
   perform pg_temp.ok(not has_function_privilege(role_name,f,'EXECUTE'),'untrusted/direct server role denied');
  end loop;
  perform pg_temp.ok((select prosecdef and proconfig=array['search_path=""'] from pg_proc where oid=f),'restricted definer');
 end loop;
 perform pg_temp.ok((select relrowsecurity from pg_class where oid='booking_private.portal_lesson_requests'::regclass),'action history has RLS');
 perform pg_temp.ok(not has_table_privilege('authenticated','booking_private.portal_lesson_requests','SELECT,INSERT,UPDATE,DELETE'),'private audit inaccessible');
 perform pg_temp.ok(not has_function_privilege('authenticated','booking_private.manage_lesson(text,uuid,uuid,uuid,text,boolean)','EXECUTE'),'helper not callable');
end $$;
select count(*) as assertions_passed from phase2e_checks;
rollback;
