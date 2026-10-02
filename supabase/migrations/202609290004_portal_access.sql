-- Phase 2B: server-only identity binding and bounded access-request throttling.
begin;

create table booking_private.portal_request_limits (
  bucket text primary key check (bucket='global' or bucket ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  last_request_at timestamptz not null,
  requests integer not null check (requests>0)
);
alter table booking_private.portal_request_limits enable row level security;
revoke all on booking_private.portal_request_limits from public,anon,authenticated,service_role;

-- HMAC of normalized email is computed in Edge; never persist raw addresses here.
-- Same limits/response for eligible and ineligible requests. Global cap bounds storage.
create function public.portal_request_claim(p_email_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare g booking_private.portal_request_limits%rowtype; e booking_private.portal_request_limits%rowtype;
begin
  if p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='P0001',message='INVALID_REQUEST';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('portal-access-request-limits',0));
  delete from booking_private.portal_request_limits where window_start<now()-interval '24 hours';
  select * into g from booking_private.portal_request_limits where bucket='global' for update;
  if found and g.window_start>now()-interval '1 hour' and g.requests>=30 then return false; end if;
  select * into e from booking_private.portal_request_limits where bucket=p_email_hash for update;
  if found and (e.last_request_at>now()-interval '60 seconds'
      or (e.window_start>now()-interval '1 hour' and e.requests>=3)) then return false; end if;
  insert into booking_private.portal_request_limits as limits(bucket,window_start,last_request_at,requests)
    values('global',now(),now(),1),(p_email_hash,now(),now(),1)
  on conflict(bucket) do update set
    requests=case when limits.window_start<=now()-interval '1 hour' then 1 else limits.requests+1 end,
    window_start=case when limits.window_start<=now()-interval '1 hour' then now() else limits.window_start end,
    last_request_at=now();
  return true;
end $$;

-- Null p_auth_user_id means: find an existing matching Auth identity, or return null.
-- Non-null means: bind that exact identity. Neither path creates/confirms an Auth user.
create function public.portal_auth_link(p_student_id uuid,p_auth_user_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare s booking_private.students%rowtype; u auth.users%rowtype; candidates integer;
begin
  select * into s from booking_private.students where id=p_student_id for update;
  if not found or not exists(select 1 from booking_private.purchases p where p.student_id=s.id and p.status='active') then
    raise exception using errcode='P0001',message='PORTAL_ACCESS_DENIED';
  end if;
  if s.auth_user_id is not null and p_auth_user_id is not null and s.auth_user_id<>p_auth_user_id then
    raise exception using errcode='P0001',message='AUTH_LINK_CONFLICT';
  end if;
  if coalesce(s.auth_user_id,p_auth_user_id) is not null then
    select * into u from auth.users where id=coalesce(s.auth_user_id,p_auth_user_id) for share;
  else
    select count(*) into candidates from auth.users where lower(btrim(email))=s.email and deleted_at is null;
    if candidates>1 then raise exception using errcode='P0001',message='AUTH_LINK_CONFLICT'; end if;
    if candidates=0 then return null; end if;
    select * into u from auth.users where lower(btrim(email))=s.email and deleted_at is null for share;
  end if;
  -- A prepared link is NOT proof of identity. Reject unsafe legacy/password identities
  -- instead of making an unverified password usable when the owner clicks a magic link.
  if u.id is null or lower(btrim(u.email)) is distinct from s.email or u.deleted_at is not null
    or u.banned_until>now() or coalesce(u.is_anonymous,false) or coalesce(u.encrypted_password,'')<>'' then
    raise exception using errcode='P0001',message='AUTH_LINK_CONFLICT';
  end if;
  if exists(select 1 from booking_private.students where auth_user_id=u.id and id<>s.id) then
    raise exception using errcode='P0001',message='AUTH_LINK_CONFLICT';
  end if;
  if s.auth_user_id is null then
    begin
      update booking_private.students set auth_user_id=u.id,updated_at=now() where id=s.id;
    exception when unique_violation then
      raise exception using errcode='P0001',message='AUTH_LINK_CONFLICT';
    end;
  end if;
  return u.id;
end $$;

-- Technical callback only: a boolean, never student/purchase/credit data.
-- Supabase validates the JWT; identity comes from auth.uid(), never request email.
create function public.portal_current_access()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from booking_private.students s join auth.users u on u.id=s.auth_user_id
    where u.id=auth.uid() and u.email_confirmed_at is not null and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=now()) and not coalesce(u.is_anonymous,false)
      and lower(btrim(u.email))=s.email
      and exists(select 1 from booking_private.purchases p where p.student_id=s.id and p.status='active'));
$$;

revoke all on function public.portal_request_claim(text),public.portal_auth_link(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.portal_request_claim(text),public.portal_auth_link(uuid,uuid) to service_role;
revoke all on function public.portal_current_access() from public,anon,authenticated,service_role;
grant execute on function public.portal_current_access() to authenticated;
commit;
