begin;

-- Server-only portal eligibility lookup.
-- Email identifies the business profile, but does not authenticate the person.
create function public.portal_access_eligibility(p_email text)
returns table (
  student_id uuid,
  normalized_email text,
  auth_user_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  v_email := lower(btrim(p_email));

  if v_email is null
     or length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    return;
  end if;

  return query
  select
    s.id,
    s.email,
    s.auth_user_id
  from booking_private.students s
  where s.email = v_email
    and exists (
      select 1
      from booking_private.purchases p
      where p.student_id = s.id
        and p.status = 'active'
    )
  limit 1;
end;
$$;

revoke all
  on function public.portal_access_eligibility(text)
  from public, anon, authenticated;

grant execute
  on function public.portal_access_eligibility(text)
  to service_role;

comment on function public.portal_access_eligibility(text) is
  'Server-only eligibility lookup for Mis clases. Returns a student only when the normalized email belongs to a student with at least one active paid purchase. This function does not authenticate the requester.';

commit;