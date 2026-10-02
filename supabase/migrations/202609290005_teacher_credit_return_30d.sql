-- Approved 30-day teacher cancellation exception. No prior migration is rewritten.
begin;
create or replace function public.credit_resolve_booking(p_booking_id uuid,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b booking_private.bookings%rowtype; c booking_private.credits%rowtype;
  a booking_private.credit_allocations%rowtype; e booking_private.credit_events%rowtype;
  v_student uuid; v_return boolean; v_extend boolean; v_previous_expiry timestamptz; fp jsonb; result jsonb;
begin
  if p_request_id is null or p_booking_id is null or p_reason is null or p_reason not in
    ('completed','no_show','student_cancel','student_reschedule','teacher_cancel') then
    raise exception using errcode='P0001',message='INVALID_REQUEST';
  end if;
  fp := jsonb_build_object('action','resolve','bookingId',p_booking_id,'reason',p_reason);
  perform pg_advisory_xact_lock(hashtextextended('credit-request:'||p_request_id,0));
  select * into e from booking_private.credit_events where request_id=p_request_id;
  if found then
    if e.fingerprint<>fp then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    return e.result;
  end if;
  select p.student_id into v_student from booking_private.credit_allocations a0
    join booking_private.credits c0 on c0.id=a0.credit_id join booking_private.purchases p on p.id=c0.purchase_id
    where a0.booking_id=p_booking_id;
  if not found then raise exception using errcode='P0001',message='ALLOCATION_NOT_FOUND'; end if;
  perform 1 from booking_private.students where id=v_student for update;
  select * into b from booking_private.bookings where id=p_booking_id for update;
  select * into a from booking_private.credit_allocations where booking_id=b.id for update;
  if a.status<>'reserved' or b.status<>'confirmed' then
    raise exception using errcode='P0001',message='ALLOCATION_ALREADY_RESOLVED';
  end if;
  if (p_reason='completed' and b.ends_at>now()) or (p_reason='no_show' and b.starts_at>now()) then
    raise exception using errcode='P0001',message='LESSON_NOT_STARTED_OR_FINISHED';
  end if;
  select * into c from booking_private.credits where id=a.credit_id for update;
  v_return := p_reason='teacher_cancel' or
    (p_reason in ('student_cancel','student_reschedule') and b.starts_at>=now()+interval '12 hours');
  -- Approved exception: a unit that expired while assigned gets 30 calendar days
  -- from teacher cancellation, in Warsaw. Still-valid units keep their original expiry.
  v_previous_expiry := c.expires_at;
  v_extend := v_return and p_reason='teacher_cancel' and c.expires_at<=now();
  update booking_private.credit_allocations set status=case when v_return then 'returned' else 'consumed' end,
    resolved_at=now(),reason=p_reason where id=a.id returning * into a;
  if v_extend then
    update booking_private.credits set requires_expiry_review=false,
      expires_at=((now() at time zone 'Europe/Warsaw')+interval '30 days') at time zone 'Europe/Warsaw'
      where id=c.id returning * into c;
  end if;
  if p_reason in ('student_cancel','student_reschedule','teacher_cancel') then
    update booking_private.bookings set status='cancelled' where id=b.id;
  end if;
  result := jsonb_build_object('allocationId',a.id,'creditId',c.id,'bookingId',b.id,'status',a.status,
    'reason',p_reason,'requiresExpiryReview',false,'previousExpiresAt',v_previous_expiry,
    'expiresAt',c.expires_at,'teacherExtensionApplied',v_extend);
  insert into booking_private.credit_events(purchase_id,credit_id,booking_id,action,request_id,fingerprint,result)
    values(c.purchase_id,c.id,b.id,case when v_return then 'credit_returned' else 'credit_consumed' end,p_request_id,fp,result);
  return result;
end;
$$;

commit;
