-- Incremental correction verified against real Supabase invite confirmation.
begin;
create or replace function public.portal_auth_link(p_student_id uuid,p_auth_user_id uuid default null)
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
  -- A prepared link is NOT proof of identity. Reject password identities on FIRST
  -- association to prevent pre-hijacking. A previously checked/bound identity remains
  -- valid: Supabase itself generates an unknown random password on invite verification.
  -- Never interpret that internal hash as a new or conflicting identity.
  if u.id is null or lower(btrim(u.email)) is distinct from s.email or u.deleted_at is not null
    or u.banned_until>now() or coalesce(u.is_anonymous,false)
    or (s.auth_user_id is null and coalesce(u.encrypted_password,'')<>'') then
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

commit;
