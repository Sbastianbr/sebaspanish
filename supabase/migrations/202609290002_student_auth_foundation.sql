begin;

-- Phase 2B foundation:
-- Link a business student profile to a verified Supabase Auth identity.
-- Nullable because a paid student may exist before ever opening "Mis clases".
--
-- Deleting an Auth identity must NEVER delete commercial/history data.
alter table booking_private.students
  add column auth_user_id uuid
  references auth.users(id)
  on delete set null;

-- One Auth identity may belong to only one SebaSpanish student.
-- PostgreSQL unique permits multiple NULL values, which is what we want.
create unique index students_auth_user_id_uidx
  on booking_private.students(auth_user_id)
  where auth_user_id is not null;

comment on column booking_private.students.auth_user_id is
  'Verified Supabase Auth identity for private student portal access. NULL until identity is linked. Email alone is never proof of ownership.';

commit;