-- Development/disposable DB only. No mail. Entire fixture transaction is rolled back.
begin;
create temporary table phase2b_checks(name text);
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if;
  insert into phase2b_checks values(label); end $$;
create function pg_temp.student(email text) returns uuid language sql as $$
  select public.student_upsert(jsonb_build_object('email',email,'name','Phase 2B fixture',
    'phone','','language','es','country','','spanishLevel',''));
$$;

do $$
declare v_email text:=gen_random_uuid()||'@example.invalid'; s uuid; other_s uuid; p uuid; u uuid:=gen_random_uuid();
  other_u uuid:=gen_random_uuid(); result uuid;
begin
  perform pg_temp.ok((select count(*)=0 from public.portal_access_eligibility(v_email)),'nonexistent email is ineligible');
  s:=pg_temp.student(v_email);
  perform pg_temp.ok((select count(*)=0 from public.portal_access_eligibility(v_email)),'student without purchase is ineligible');
  begin perform public.purchase_prepare(s,'prueba',gen_random_uuid()); raise exception 'trial granted paid purchase';
    exception when sqlstate 'P0001' then if sqlerrm<>'INVALID_PLAN' then raise; end if; end;
  perform pg_temp.ok((select count(*)=0 from public.portal_access_eligibility(v_email)),'trial cannot unlock portal');
  p:=(public.purchase_prepare(s,'1a1-1',gen_random_uuid())->>'id')::uuid;
  perform pg_temp.ok((select count(*)=0 from public.portal_access_eligibility(v_email)),'pending purchase is ineligible');
  perform public.purchase_activate(p,'phase2b-sql-test',gen_random_uuid()::text,gen_random_uuid()::text);
  perform pg_temp.ok((select student_id=s from public.portal_access_eligibility(v_email)),'active individual purchase unlocks access');
  perform pg_temp.ok((select student_id=s from public.portal_access_eligibility('  '||upper(v_email)||'  ')),'eligibility normalizes case and whitespace');
  update booking_private.credits set expires_at=now()-interval '1 second' where purchase_id=p;
  perform pg_temp.ok((select student_id=s from public.portal_access_eligibility(v_email)),'expired credits do not revoke access');
  -- Eligibility depends on purchase history, not any credit quantity or state.
  delete from booking_private.credit_events where purchase_id=p and credit_id is not null;
  delete from booking_private.credits where purchase_id=p;
  perform pg_temp.ok((select student_id=s from public.portal_access_eligibility(v_email)),'zero credits do not revoke paid customer access');
  perform pg_temp.ok(public.portal_auth_link(s) is null,'eligible customer with no identity returns null');
  insert into auth.users(id,email,encrypted_password,is_anonymous) values(u,v_email,'',false),(other_u,gen_random_uuid()||'@example.invalid','',false);
  result:=public.portal_auth_link(s);
  perform pg_temp.ok(result=u,'matching existing Auth identity is linked');
  perform pg_temp.ok(public.portal_auth_link(s,u)=u and public.portal_auth_link(s)=u,'binding is idempotent');
  perform pg_temp.ok((select auth_user_id=u from booking_private.students where id=s),'exact Auth ID persisted');
  begin perform public.portal_auth_link(s,other_u); raise exception 'identity switched';
    exception when sqlstate 'P0001' then if sqlerrm<>'AUTH_LINK_CONFLICT' then raise; end if; end;
  perform pg_temp.ok((select auth_user_id=u from booking_private.students where id=s),'conflict cannot silently switch identity');
  other_s:=pg_temp.student(gen_random_uuid()||'@example.invalid');
  begin update booking_private.students set auth_user_id=u where id=other_s; raise exception 'identity shared';
    exception when unique_violation then null; end;
  perform pg_temp.ok(true,'unique index prevents two students sharing Auth identity');
  begin perform public.portal_auth_link(other_s,u); raise exception 'unpaid linked';
    exception when sqlstate 'P0001' then if sqlerrm<>'PORTAL_ACCESS_DENIED' then raise; end if; end;
  perform pg_temp.ok(true,'link RPC rechecks paid eligibility');
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform pg_temp.ok(not public.portal_current_access(),'prepared unconfirmed identity is not authenticated access');
  update auth.users set email_confirmed_at=now() where id=u;
  perform pg_temp.ok(public.portal_current_access(),'confirmed JWT owner with active purchase is authorized');
  update auth.users set encrypted_password='supabase-generated-after-invitation' where id=u;
  perform pg_temp.ok(public.portal_auth_link(s)=u,'previously bound invitation remains reusable after Supabase adds internal password hash');
  perform set_config('request.jwt.claim.sub',other_u::text,true);
  perform pg_temp.ok(not public.portal_current_access(),'another JWT cannot claim student email');
  perform set_config('request.jwt.claim.sub',u::text,true);
  update auth.users set email='changed-'||v_email where id=u;
  perform pg_temp.ok(not public.portal_current_access(),'changed Auth email fails closed');
  begin perform public.portal_auth_link(s); raise exception 'mismatched identity accepted';
    exception when sqlstate 'P0001' then if sqlerrm<>'AUTH_LINK_CONFLICT' then raise; end if; end;
  update auth.users set email=email_confirmed.email from (select email from booking_private.students where id=s) email_confirmed where id=u;
  update auth.users set banned_until=now()+interval '1 day' where id=u;
  perform pg_temp.ok(not public.portal_current_access(),'banned identity denied');
  begin perform public.portal_auth_link(s); raise exception 'banned identity accepted';
    exception when sqlstate 'P0001' then if sqlerrm<>'AUTH_LINK_CONFLICT' then raise; end if; end;
  update auth.users set banned_until=null,encrypted_password='unsafe-legacy-password' where id=u;
  update booking_private.students set auth_user_id=null where id=s;
  begin perform public.portal_auth_link(s); raise exception 'password identity linked';
    exception when sqlstate 'P0001' then if sqlerrm<>'AUTH_LINK_CONFLICT' then raise; end if; end;
  perform pg_temp.ok(true,'legacy password identity needs explicit review, never silently enabled');
  update auth.users set encrypted_password='' where id=u;
  perform public.portal_auth_link(s,u);
  delete from auth.users where id=u;
  perform pg_temp.ok((select auth_user_id is null from booking_private.students where id=s),'Auth deletion clears optional link');
  perform pg_temp.ok((select count(*)=1 from booking_private.purchases where id=p),'Auth deletion preserves commercial data');
end $$;

do $$
declare role_name text; f regprocedure; t text;
begin
  foreach f in array array['public.portal_access_eligibility(text)'::regprocedure,
    'public.portal_auth_link(uuid,uuid)'::regprocedure,'public.portal_request_claim(text)'::regprocedure] loop
    foreach role_name in array array['anon','authenticated'] loop
      perform pg_temp.ok(not has_function_privilege(role_name,f,'EXECUTE'),f::text||' denied to '||role_name);
    end loop;
    perform pg_temp.ok(has_function_privilege('service_role',f,'EXECUTE'),f::text||' allowed to server');
    perform pg_temp.ok((select prosecdef and proconfig=array['search_path=""'] from pg_proc where oid=f),f::text||' restricted SECURITY DEFINER');
  end loop;
  perform pg_temp.ok(not has_function_privilege('anon','public.portal_current_access()','EXECUTE'),'anonymous cannot inspect current access');
  perform pg_temp.ok(has_function_privilege('authenticated','public.portal_current_access()','EXECUTE'),'authenticated current-access boolean permitted');
  foreach t in array array['students','purchases','credits','credit_allocations','credit_events','portal_request_limits'] loop
    perform pg_temp.ok((select relrowsecurity from pg_class where oid=('booking_private.'||t)::regclass),t||' RLS enabled');
    foreach role_name in array array['anon','authenticated','service_role'] loop
      perform pg_temp.ok(not has_table_privilege(role_name,'booking_private.'||t,'SELECT,INSERT,UPDATE,DELETE'),t||' closed to direct '||role_name);
    end loop;
  end loop;
end $$;

-- Throttle test only changes this transaction's rows; ROLLBACK restores prior counters.
do $$
declare h text:=repeat('a',64); i integer;
begin
  delete from booking_private.portal_request_limits;
  perform pg_temp.ok(public.portal_request_claim(h),'first access request permitted');
  perform pg_temp.ok(not public.portal_request_claim(h),'immediate repeat throttled');
  update booking_private.portal_request_limits set last_request_at=now()-interval '61 seconds' where bucket=h;
  perform pg_temp.ok(public.portal_request_claim(h),'email request allowed after cooldown');
  update booking_private.portal_request_limits set last_request_at=now()-interval '61 seconds' where bucket=h;
  perform pg_temp.ok(public.portal_request_claim(h),'third request within hour allowed');
  update booking_private.portal_request_limits set last_request_at=now()-interval '61 seconds' where bucket=h;
  perform pg_temp.ok(not public.portal_request_claim(h),'fourth request in hour rejected');
  update booking_private.portal_request_limits set window_start=now()-interval '61 minutes',last_request_at=now()-interval '61 minutes';
  perform pg_temp.ok(public.portal_request_claim(h),'new hourly window resets counters');
  for i in 1..29 loop perform public.portal_request_claim(lpad(i::text,64,'0')); end loop;
  perform pg_temp.ok(not public.portal_request_claim(repeat('b',64)),'global hourly cap prevents unbounded email work');
  begin perform public.portal_request_claim('raw@email.invalid'); raise exception 'raw email stored';
    exception when sqlstate 'P0001' then if sqlerrm<>'INVALID_REQUEST' then raise; end if; end;
  perform pg_temp.ok(true,'limiter rejects raw addresses');
end $$;
select count(*) as passed_assertions from phase2b_checks;
rollback;
select 'Phase 2B assertions passed; fixtures rolled back' as status;
