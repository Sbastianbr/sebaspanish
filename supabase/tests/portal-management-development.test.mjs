// Explicitly opted-in real Development tests. No emails, payments or real student fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile),root=fileURLToPath(new URL('../../',import.meta.url));
const ref='vvvugnkvtkcfuwxroies',url=`https://${ref}.supabase.co`;
test('Phase 2E real Auth, management races, portal and cleanup',{
 skip:process.env.PORTAL_MANAGEMENT_TEST_DEVELOPMENT!=='yes',timeout:480000,
},async t=>{
 assert.equal(process.env.PORTAL_MANAGEMENT_TEST_PROJECT_REF,ref);
 assert.equal((await readFile(join(root,'supabase/.temp/project-ref'),'utf8')).trim(),ref);
 const folder=await mkdtemp(join(tmpdir(),'seba-2e-real-')),cli=process.env.SUPABASE_BIN||'supabase';
 let sequence=0,serverKey,publicKey;const authIds=[],sessions=[],students=[randomUUID(),randomUUID(),randomUUID()],slots=Array.from({length:16},()=>randomUUID());
 async function query(sql){const file=join(folder,`${++sequence}.sql`);await writeFile(file,sql);
  const {stdout}=await exec(cli,['db','query','--linked','--project-ref',ref,'--file',file,'--output','json'],{cwd:root,timeout:45000,maxBuffer:1000000});
  return JSON.parse(stdout.slice(stdout.indexOf('{'))).rows;}
 async function request(path,body,token=serverKey){const response=await fetch(url+path,{method:'POST',headers:{apikey:token===serverKey?serverKey:publicKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  return {ok:response.ok,status:response.status,body:await response.json()};}
 const rpc=(name,args,token)=>request('/rest/v1/rpc/'+name,args,token);
 const args=(slot)=>({p_slot_id:slot,p_request_id:randomUUID(),p_timezone:'Europe/Warsaw'});
 let sessionA,sessionB;
 try{
  const {stdout}=await exec(cli,['projects','api-keys','--project-ref',ref,'--reveal','--output','json'],{cwd:root,maxBuffer:1000000});
  const parsed=JSON.parse(stdout),keys=Array.isArray(parsed)?parsed:parsed.api_keys;
  serverKey=keys.find(k=>k.name==='service_role').api_key;publicKey=keys.find(k=>k.name==='anon').api_key;
  // Fail closed before creating fixtures if the reviewed migration has not been applied.
  assert.equal((await query("select to_regprocedure('public.portal_cancel_class(uuid,uuid,boolean)') is not null as ready"))[0].ready,true);
  // Non-secret manifest survives interruption; delete only after verified cleanup.
  const saveManifest=()=>writeFile(join(folder,'fixtures.json'),JSON.stringify({ref,students,slots,authIds}),{mode:0o600});
  await saveManifest();console.log('Technical fixture manifest:',join(folder,'fixtures.json'));
  for(const student of students){
   const email=`${student}@example.invalid`;
   const generated=await request('/auth/v1/admin/generate_link',{type:'invite',email});
   assert.equal(generated.ok,true,'technical invitation link generated without email delivery');
   const uid=generated.body.id||generated.body.user?.id;assert.ok(uid);authIds.push(uid);await saveManifest();
   const verified=await request('/auth/v1/verify',{type:'invite',token_hash:generated.body.hashed_token},publicKey);
   assert.equal(verified.ok,true,'technical Auth session verified');sessions.push(verified.body);
   if(student===students[0])sessionA=verified.body;if(student===students[1])sessionB=verified.body;
   await query(`insert into booking_private.students(id,email,name,contact_language,auth_user_id)
    values('${student}','${email}','Phase2E technical fixture','es','${uid}');`);
   const prepared=await rpc('purchase_prepare',{p_student_id:student,p_offer_code:student===students[2]?'1a1-1':'1a1-8',p_request_id:randomUUID()});assert.equal(prepared.ok,true);
   assert.equal((await rpc('purchase_activate',{p_purchase_id:prepared.body.id,p_external_source:'phase2e-only',p_external_payment_id:randomUUID(),p_external_event_id:randomUUID()})).ok,true);
  }
  // Use a free technical window; never disable/delete existing availability or bookings.
  const ranges=slots.map((id,i)=>`('${id}',date_trunc('day',now())+interval '44 days 00:11'+interval '${i*75} minutes',date_trunc('day',now())+interval '44 days 01:11'+interval '${i*75} minutes',true)`);
  await query(`begin;do $$ begin if exists(select 1 from booking_private.bookings where status in('pending','confirmed') and tstzrange(starts_at,ends_at,'[)') && tstzrange(date_trunc('day',now())+interval '44 days',date_trunc('day',now())+interval '46 days','[)')) then raise exception 'Technical test window is occupied';end if;end $$;
   insert into booking_private.availability_slots(id,starts_at,ends_at,enabled) values ${ranges.join(',')};commit;`);
  const report=[];
  async function check(label,fn){await fn();report.push(label);await writeFile(join(folder,'passed.json'),JSON.stringify(report));console.log('PASS',label);}
  async function book(index,session=sessionA){
   const result=await rpc('portal_book_class',args(slots[index]),session.access_token);assert.equal(result.ok,true,JSON.stringify(result.body));
   await query(`update booking_private.bookings set created_at=now()-interval '2 hours' where student_id in('${students[0]}','${students[1]}','${students[2]}')`);
   return result.body;
  }
  const cancel=(booking,session=sessionA,request=randomUUID())=>rpc('portal_cancel_class',{p_booking_id:booking.id,p_request_id:request},session.access_token);
  const move=(booking,index,session=sessionA,request=randomUUID())=>rpc('portal_reschedule_class',{p_booking_id:booking.id,p_slot_id:slots[index],p_request_id:request,p_timezone:'Europe/Warsaw'},session.access_token);
  let original=await book(0),other=await book(1,sessionB);
  await check('two tabs cancelling: one settlement; retry and ownership isolation',async()=>{
   const requests=[randomUUID(),randomUUID()];const results=await Promise.all(requests.map(id=>cancel(original,sessionA,id)));
   assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).body.message,'BOOKING_ALREADY_CANCELLED');
   const i=results.findIndex(r=>r.ok);assert.equal(results[i].body.creditOutcome,'returned');assert.deepEqual((await cancel(original,sessionA,requests[i])).body,results[i].body);
   assert.equal((await cancel(other,sessionA,requests[i])).body.message,'IDEMPOTENCY_CONFLICT');
   assert.equal((await cancel(original,sessionB)).body.message,'BOOKING_NOT_FOUND');
   assert.equal(Number((await query(`select count(*) as n from booking_private.credit_events where booking_id='${original.id}' and action='credit_returned'`))[0].n),1);
  });
  original=await book(2);
  await check('cancel versus reschedule: exactly one mutation wins',async()=>{
   const results=await Promise.all([cancel(original),move(original,3)]);
   assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).body.message,'BOOKING_ALREADY_CANCELLED');
  });
  original=await book(4);let moved;
  await check('valid reschedule; same request retry; different payload conflict; history',async()=>{
   const request=randomUUID();const result=await move(original,5,sessionA,request);assert.equal(result.ok,true);moved=result.body;
   assert.deepEqual((await move(original,5,sessionA,request)).body,moved);
   assert.equal((await move(original,6,sessionA,request)).body.message,'IDEMPOTENCY_CONFLICT');
   const snap=(await rpc('portal_my_data',{},sessionA.access_token)).body;
   assert.equal(snap.history.find(b=>b.id===original.id).status,'rescheduled');assert.ok(snap.upcoming.some(b=>b.id===moved.replacement.id));
  });
  original=await book(6);
  await check('two reschedules of one booking: only one replacement',async()=>{
   const results=await Promise.all([move(original,7),move(original,8)]);
   assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).body.message,'BOOKING_ALREADY_CANCELLED');
   assert.equal(Number((await query(`select count(*) as n from booking_private.portal_lesson_requests where booking_id='${original.id}'`))[0].n),1);
  });
  original=await book(9);other=await book(10,sessionB);
  await check('two students moving to same slot: loser keeps original and credit',async()=>{
   const results=await Promise.all([move(original,11),move(other,11,sessionB)]);
   assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).body.message,'SLOT_UNAVAILABLE');
   const loser=results[0].ok?other:original,session=results[0].ok?sessionB:sessionA;
   const rows=await query(`select b.status as booking,a.status as allocation from booking_private.bookings b join booking_private.credit_allocations a on a.booking_id=b.id where b.id='${loser.id}'`);
   assert.deepEqual(rows[0],{booking:'confirmed',allocation:'reserved'});
   assert.equal((await move(loser,11,session)).body.message,'SLOT_UNAVAILABLE');
   assert.equal((await rpc('portal_my_data',{},session.access_token)).body.upcoming.find(b=>b.id===loser.id).status,'confirmed');
  });
  await check('real SDK/browser cancellation and rescheduling update portal',async()=>{
   assert.ok(process.env.PLAYWRIGHT_MODULE,'real browser verification required');
   const first=await book(12),second=await book(13);
   const {chromium}=await import(process.env.PLAYWRIGHT_MODULE),browser=await chromium.launch({channel:'chrome',headless:true});
   try{
    const context=await browser.newContext({timezoneId:'Europe/Warsaw',viewport:{width:390,height:1000}});
    await context.addInitScript(session=>localStorage.setItem('sebaspanish-development-auth',JSON.stringify(session)),sessionA);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4181/sebaspanishv2/mis-clases.html');await page.locator('#portal-content:not([hidden])').waitFor();
    await page.locator(`[data-booking-id="${first.id}"][data-manage-action="cancel"]`).click();await page.locator('#portal-manage-confirm').click();
    await page.locator('#portal-manage-status').filter({hasText:'El crédito se ha devuelto'}).waitFor();
    assert.equal(await page.locator(`[data-booking-id="${first.id}"]`).count(),0);
    await page.locator(`[data-booking-id="${second.id}"][data-manage-action="reschedule"]`).click();
    const availability=(await rpc('portal_booking_slots',{},sessionA.access_token)).body;
    const slot=availability.slots.find(s=>s.id===slots[14]);assert.ok(slot);
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(slot.startAt));
    await page.locator('#portal-manage-day option').nth(1).waitFor({state:'attached'});
    await page.selectOption('#portal-manage-day',day);await page.selectOption('#portal-manage-slot',slots[14]);
    await page.locator('#portal-manage-confirm').click();await page.locator('#portal-manage-status').filter({hasText:'Clase reprogramada'}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
    await context.close();
   }finally{await browser.close();}
  });
  await check('guest Edge remains independent',async()=>{
   const payload={type:'1a1',plan:4,slotId:slots[15],requestId:randomUUID(),timezone:'UTC',language:'es',student:{name:'Phase2E guest',email:`${students[2]}@example.invalid`,phone:'',language:'es',country:'',spanishLevel:'',message:''}};
   const response=await fetch(url+'/functions/v1/booking-create',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:4181'},body:JSON.stringify(payload)});
   assert.equal(response.ok,true);assert.equal((await response.json()).price,230);
   assert.equal((await query(`select student_id is null as guest from booking_private.bookings where request_id='${payload.requestId}'`))[0].guest,true);
  });
  await check('SQL 2A/2B/2C/2D/2E: late rules, expired credits, rollback and permissions',async()=>{
   for(const file of ['credits.sql','portal.sql','portal-data.sql','portal-booking.sql','portal-management.sql']){
    await query(await readFile(join(root,'supabase/tests',file),'utf8'));console.log('SQL PASS',file);
   }
  });
 }finally{
  // Exact IDs only; preserve every pre-existing customer, booking and availability row.
  if(serverKey){
   await query(`begin;
    delete from booking_private.portal_lesson_requests where student_id in(${students.map(s=>`'${s}'`).join(',')});
    delete from booking_private.credit_events where purchase_id in(select id from booking_private.purchases where student_id in(${students.map(s=>`'${s}'`).join(',')}));
    delete from booking_private.credit_allocations where credit_id in(select c.id from booking_private.credits c join booking_private.purchases p on p.id=c.purchase_id where p.student_id in(${students.map(s=>`'${s}'`).join(',')}));
    delete from booking_private.credits where purchase_id in(select id from booking_private.purchases where student_id in(${students.map(s=>`'${s}'`).join(',')}));
    delete from booking_private.purchases where student_id in(${students.map(s=>`'${s}'`).join(',')});
    delete from booking_private.bookings where student_email in(${students.map(s=>`'${s}@example.invalid'`).join(',')});
    delete from booking_private.availability_slots where id in(${slots.map(s=>`'${s}'`).join(',')}) and not exists(select 1 from booking_private.bookings b where b.slot_id=availability_slots.id);
    delete from booking_private.students where id in(${students.map(s=>`'${s}'`).join(',')});commit;`);
   for(const id of authIds){
    await fetch(url+'/auth/v1/logout?scope=global',{method:'POST',headers:{apikey:serverKey,Authorization:`Bearer ${sessions.find(s=>s.user.id===id)?.access_token||serverKey}`}});
    const response=await fetch(url+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:{apikey:serverKey,Authorization:`Bearer ${serverKey}`}});assert.equal(response.ok,true,'technical Auth identity deleted');
   }
   const rows=await query(`select (select count(*) from booking_private.students where id in(${students.map(s=>`'${s}'`).join(',')}))+(select count(*) from booking_private.availability_slots where id in(${slots.map(s=>`'${s}'`).join(',')})) as remaining`);
   assert.equal(Number(rows[0].remaining),0,'no technical fixtures remain');
  }
  console.log('CLEANUP VERIFIED: technical business rows, slots and Auth identities removed.');
  serverKey=undefined;sessionA=undefined;sessionB=undefined;await rm(folder,{recursive:true,force:true});
 }
});
