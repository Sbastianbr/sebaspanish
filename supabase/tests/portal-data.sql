-- Development/disposable only. Every fixture is rolled back; no emails are sent.
begin;
create temporary table phase2c_checks(label text);
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'FAIL: %',label; end if;
  insert into phase2c_checks values(label);
end $$;
create function pg_temp.lesson(owner uuid,mail text,at_time timestamptz,state text)
returns uuid language plpgsql as $$
declare slot uuid:=gen_random_uuid(); booking uuid:=gen_random_uuid();
begin
  insert into booking_private.availability_slots(id,starts_at,ends_at,enabled)
    values(slot,at_time,at_time+interval '1 hour',false);
  insert into booking_private.bookings(id,request_id,request_fingerprint,slot_id,offer_code,
    booking_type,plan,sessions,duration_minutes,price_minor,currency,starts_at,ends_at,
    timezone,status,language,student_name,student_email,contact_language,student_id)
  values(booking,gen_random_uuid(),'phase2c-only',slot,'1a1-1','1a1',1,1,60,6500,'PLN',
    at_time,at_time+interval '1 hour','Europe/Warsaw',state,'es','Phase 2C fixture',mail,'es',owner);
  return booking;
end $$;

do $$
declare a uuid; b uuid; c uuid; pa uuid; pb uuid; pending uuid;
  ua uuid:=gen_random_uuid(); ub uuid:=gen_random_uuid(); uc uuid:=gen_random_uuid(); unlinked uuid:=gen_random_uuid();
  ea text:=gen_random_uuid()||'@example.invalid'; eb text:=gen_random_uuid()||'@example.invalid';
  ec text:=gen_random_uuid()||'@example.invalid';
  future timestamptz:='2100-01-01'::timestamptz+random()*interval '30 days';
  past timestamptz:='2001-01-01'::timestamptz+random()*interval '30 days';
  lesson uuid; response jsonb; b_response jsonb; field text; credit_ids uuid[];
begin
  a:=public.student_upsert(jsonb_build_object('email',ea,'name','Phase 2C A','phone','',
    'language','pl','country','Polska','spanishLevel','B1'));
  b:=public.student_upsert(jsonb_build_object('email',eb,'name','Phase 2C B','phone','',
    'language','en','country','','spanishLevel',''));
  c:=public.student_upsert(jsonb_build_object('email',ec,'name','Phase 2C pending','phone','',
    'language','es','country','','spanishLevel',''));
  pa:=(public.purchase_prepare(a,'1a1-8',gen_random_uuid())->>'id')::uuid;
  pb:=(public.purchase_prepare(b,'1a1-1',gen_random_uuid())->>'id')::uuid;
  pending:=(public.purchase_prepare(a,'1a1-4',gen_random_uuid())->>'id')::uuid;
  perform public.purchase_prepare(c,'1a1-1',gen_random_uuid());
  perform public.purchase_activate(pa,'phase2c-sql',gen_random_uuid()::text,gen_random_uuid()::text);
  perform public.purchase_activate(pb,'phase2c-sql',gen_random_uuid()::text,gen_random_uuid()::text);
  insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
    (ua,ea,now(),false),(ub,eb,now(),false),(uc,ec,now(),false),
    (unlinked,gen_random_uuid()||'@example.invalid',now(),false);
  update booking_private.students set auth_user_id=case id when a then ua when b then ub else uc end where id in(a,b,c);
  select array_agg(id order by ordinal) into credit_ids from booking_private.credits where purchase_id=pa;
  lesson:=pg_temp.lesson(a,ea,future,'confirmed');
  insert into booking_private.credit_allocations(credit_id,booking_id) values(credit_ids[1],lesson);
  lesson:=pg_temp.lesson(a,ea,past,'confirmed');
  insert into booking_private.credit_allocations(credit_id,booking_id,status,resolved_at,reason)
    values(credit_ids[2],lesson,'consumed',now(),'completed');
  lesson:=pg_temp.lesson(a,ea,past+interval '2 hours','confirmed');
  insert into booking_private.credit_allocations(credit_id,booking_id,status,resolved_at,reason)
    values(credit_ids[3],lesson,'consumed',now(),'no_show');
  lesson:=pg_temp.lesson(a,ea,future+interval '2 hours','cancelled');
  insert into booking_private.credit_allocations(credit_id,booking_id,status,resolved_at,reason)
    values(credit_ids[4],lesson,'returned',now(),'teacher_cancel');
  perform pg_temp.lesson(a,ea,past+interval '4 hours','confirmed');
  perform pg_temp.lesson(a,ea,future+interval '4 hours','pending');
  -- Same snapshot email, different/no ownership: neither may leak into A's results.
  perform pg_temp.lesson(b,ea,future+interval '6 hours','confirmed');
  perform pg_temp.lesson(null,ea,future+interval '8 hours','confirmed');
  update booking_private.credits set expires_at=now()-interval '1 second' where id=credit_ids[5];
  update booking_private.credits set requires_expiry_review=true where id=credit_ids[6];

  perform set_config('request.jwt.claim.sub','',true);
  begin perform public.portal_my_data(); raise exception 'anonymous allowed';
    exception when insufficient_privilege then perform pg_temp.ok(sqlerrm='PORTAL_ACCESS_DENIED','missing identity denied'); end;
  perform set_config('request.jwt.claim.sub',unlinked::text,true);
  begin perform public.portal_my_data(); raise exception 'unlinked allowed';
    exception when insufficient_privilege then perform pg_temp.ok(sqlerrm='PORTAL_ACCESS_DENIED','unlinked identity denied'); end;
  perform set_config('request.jwt.claim.sub',uc::text,true);
  begin perform public.portal_my_data(); raise exception 'pending allowed';
    exception when insufficient_privilege then perform pg_temp.ok(sqlerrm='PORTAL_ACCESS_DENIED','pending-only denied'); end;
  perform set_config('request.jwt.claim.sub',ua::text,true);
  response:=public.portal_my_data();
  perform pg_temp.ok(response->'profile'->>'email'=ea,'A receives A profile');
  perform pg_temp.ok(response->'profile'->>'language'='pl' and response->'profile'->>'spanishLevel'='B1','profile fields correct');
  perform pg_temp.ok((response->'credits')-'nextExpiry'=public.student_credit_balances(a),'balances exactly reuse Phase 2A');
  perform pg_temp.ok((response#>>'{credits,available}')::int=3,'returned + unallocated valid credits available');
  perform pg_temp.ok((response#>>'{credits,reserved}')::int=1,'reserved correct');
  perform pg_temp.ok((response#>>'{credits,consumed}')::int=2,'consumed correct');
  perform pg_temp.ok((response#>>'{credits,expired}')::int=1,'expired excluded from available');
  perform pg_temp.ok((response#>>'{credits,returnedPendingReview}')::int=1,'review credits excluded from available');
  perform pg_temp.ok((response#>>'{credits,nextExpiry}')::timestamptz>now(),'relevant expiry is a valid available unit');
  perform pg_temp.ok(jsonb_array_length(response->'purchases')=2,'all own active and pending purchases included');
  perform pg_temp.ok(exists(select 1 from jsonb_array_elements(response->'purchases') p where p->>'offer'='1a1-8' and p->>'priceMinor'='44000' and p->>'currency'='PLN'),'catalog purchase price correct');
  perform pg_temp.ok(jsonb_array_length(response->'upcoming')=2,'upcoming excludes foreign, guest and cancelled');
  perform pg_temp.ok(jsonb_array_length(response->'history')=4,'history includes past and future cancellations');
  foreach field in array array['completed','no_show','past','cancelled'] loop
    perform pg_temp.ok(exists(select 1 from jsonb_array_elements(response->'history') h where h->>'status'=field),'history state '||field);
  end loop;
  perform pg_temp.ok(current_setting('response.headers') like '%no-store%','private response not cacheable');
  foreach field in array array[a::text,b::text,pa::text,pb::text,ua::text,ub::text,'external_payment_id','external_event_id','fingerprint','auth_user_id'] loop
    perform pg_temp.ok(position(field in response::text)=0,'private/internal identifier absent: '||field);
  end loop;
  perform set_config('request.jwt.claim.sub',ub::text,true);
  -- Malicious client claims/parameters other than auth.uid cannot select A.
  perform set_config('request.jwt.claim.email',ea,true);
  perform set_config('request.headers',jsonb_build_object('student_id',a,'email',ea)::text,true);
  b_response:=public.portal_my_data();
  perform pg_temp.ok(b_response->'profile'->>'email'=eb,'B cannot impersonate A using email/header');
  perform pg_temp.ok(position(ea in b_response::text)=0 and position('Phase 2C A' in b_response::text)=0,'B receives no A data');
  perform pg_temp.ok(jsonb_array_length(b_response->'purchases')=1 and jsonb_array_length(b_response->'upcoming')=1,'B own purchases/classes only');
  begin execute 'select public.portal_my_data($1)' using a; raise exception 'ID accepted';
    exception when undefined_function then perform pg_temp.ok(true,'RPC has no identity parameters'); end;
  update booking_private.credits set expires_at=now()-interval '1 second' where purchase_id=pb;
  perform pg_temp.ok(public.portal_my_data()#>>'{credits,available}'='0','expired-only paid customer retains access');
  update auth.users set banned_until=now()+interval '1 day' where id=ub;
  begin perform public.portal_my_data(); raise exception 'banned allowed';
    exception when insufficient_privilege then perform pg_temp.ok(true,'banned identity denied'); end;
end $$;

do $$
declare role_name text; tbl text;
begin
  perform pg_temp.ok(has_function_privilege('authenticated','public.portal_my_data()','EXECUTE'),'authenticated RPC grant');
  foreach role_name in array array['anon','service_role'] loop
    perform pg_temp.ok(not has_function_privilege(role_name,'public.portal_my_data()','EXECUTE'),'no RPC grant: '||role_name);
  end loop;
  perform pg_temp.ok((select prosecdef and proconfig=array['search_path=""'] and pronargs=0
    from pg_proc where oid='public.portal_my_data()'::regprocedure),'restricted zero-argument SECURITY DEFINER');
  foreach tbl in array array['students','purchases','credits','bookings','credit_allocations','credit_events','portal_request_limits'] loop
    perform pg_temp.ok((select relrowsecurity from pg_class where oid=('booking_private.'||tbl)::regclass),'RLS remains on: '||tbl);
    foreach role_name in array array['anon','authenticated','service_role'] loop
      perform pg_temp.ok(not has_table_privilege(role_name,'booking_private.'||tbl,'SELECT,INSERT,UPDATE,DELETE'),'private table closed: '||tbl||'/'||role_name);
    end loop;
  end loop;
end $$;
select count(*) as passed from phase2c_checks;
rollback;
select 'Phase 2C own-data assertions passed; all fixtures rolled back' as status;
