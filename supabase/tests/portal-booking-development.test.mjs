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
test('Phase 2D real Auth + PostgreSQL concurrency, isolation and cleanup',{
 skip:process.env.PORTAL_BOOKING_TEST_DEVELOPMENT!=='yes',timeout:240000,
},async t=>{
 assert.equal(process.env.PORTAL_BOOKING_TEST_PROJECT_REF,ref);
 assert.equal((await readFile(join(root,'supabase/.temp/project-ref'),'utf8')).trim(),ref);
 const folder=await mkdtemp(join(tmpdir(),'seba-2d-real-')),cli=process.env.SUPABASE_BIN||'supabase';
 let sequence=0,serverKey,publicKey;const authIds=[],sessions=[],students=[randomUUID(),randomUUID(),randomUUID()],slots=Array.from({length:8},()=>randomUUID());
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
  assert.equal((await query("select to_regprocedure('public.portal_book_class(uuid,uuid,text)') is not null as ready"))[0].ready,true);
  for(const student of students){
   const email=`${student}@example.invalid`;
   const generated=await request('/auth/v1/admin/generate_link',{type:'invite',email});
   assert.equal(generated.ok,true,'technical invitation link generated without email delivery');
   const uid=generated.body.id||generated.body.user?.id;assert.ok(uid);authIds.push(uid);
   const verified=await request('/auth/v1/verify',{type:'invite',token_hash:generated.body.hashed_token},publicKey);
   assert.equal(verified.ok,true,'technical Auth session verified');sessions.push(verified.body);
   if(student===students[0])sessionA=verified.body;if(student===students[1])sessionB=verified.body;
   await query(`insert into booking_private.students(id,email,name,contact_language,auth_user_id)
    values('${student}','${email}','Phase2D technical fixture','es','${uid}');`);
   const prepared=await rpc('purchase_prepare',{p_student_id:student,p_offer_code:'1a1-1',p_request_id:randomUUID()});assert.equal(prepared.ok,true);
   assert.equal((await rpc('purchase_activate',{p_purchase_id:prepared.body.id,p_external_source:'phase2d-only',p_external_payment_id:randomUUID(),p_external_event_id:randomUUID()})).ok,true);
  }
  // Use a free technical window; never disable/delete existing availability or bookings.
  const ranges=slots.map((id,i)=>`('${id}',date_trunc('day',now())+interval '43 days 00:07'+interval '${i*75} minutes',date_trunc('day',now())+interval '43 days 01:07'+interval '${i*75} minutes',true)`);
  await query(`begin;do $$ begin if exists(select 1 from booking_private.bookings where status in('pending','confirmed') and tstzrange(starts_at,ends_at,'[)') && tstzrange(date_trunc('day',now())+interval '43 days',date_trunc('day',now())+interval '44 days','[)')) then raise exception 'Technical test window is occupied';end if;end $$;
   insert into booking_private.availability_slots(id,starts_at,ends_at,enabled) values ${ranges.join(',')};commit;`);
  let winner,winningArgs;
  await t.test('two tabs / last credit: one winner and complete rollback for loser',async()=>{
   const attempts=[args(slots[0]),args(slots[1])];
   const results=await Promise.all(attempts.map(a=>rpc('portal_book_class',a,sessionA.access_token)));
   assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).body.message,'NO_AVAILABLE_CREDITS');
   const index=results.findIndex(r=>r.ok);winner=results[index].body;winningArgs=attempts[index];
   const rows=await query(`select count(*) as n from booking_private.bookings where student_id='${students[0]}'`);assert.equal(Number(rows[0].n),1);
  });
  await t.test('same request retry is idempotent and a different payload conflicts',async()=>{
   const [a,b]=await Promise.all([rpc('portal_book_class',winningArgs,sessionA.access_token),rpc('portal_book_class',winningArgs,sessionA.access_token)]);
   assert.equal(a.ok,true);assert.deepEqual(a.body,winner);assert.deepEqual(a.body,b.body);
   const changed=await rpc('portal_book_class',{...winningArgs,p_slot_id:slots[2]},sessionA.access_token);assert.equal(changed.body.message,'IDEMPOTENCY_CONFLICT');
   assert.equal((await rpc('portal_book_class',winningArgs,sessionB.access_token)).body.message,'IDEMPOTENCY_CONFLICT');
  });
  await t.test('portal reflects booking; other account stays isolated; identity tampering rejected',async()=>{
   const a=await rpc('portal_my_data',{},sessionA.access_token),b=await rpc('portal_my_data',{},sessionB.access_token);
   assert.equal(a.body.upcoming.length,1);assert.equal(a.body.credits.reserved,1);assert.equal(b.body.upcoming.length,0);
   for(const extra of [{student_id:students[0]},{email:`${students[0]}@example.invalid`},{credit_id:randomUUID()},{price:0}])
    assert.equal((await rpc('portal_book_class',{...args(slots[3]),...extra},sessionB.access_token)).ok,false);
   assert.equal((await rpc('portal_book_class',args(slots[3]),publicKey)).ok,false);
  });
  await t.test('existing early cancellation returns exactly one credit',async()=>{
   const result=await rpc('credit_resolve_booking',{p_booking_id:winner.id,p_reason:'student_cancel',p_request_id:randomUUID()});
   assert.equal(result.body.status,'returned');assert.equal((await rpc('portal_my_data',{},sessionA.access_token)).body.credits.available,1);
  });
  await t.test('two users / one slot: loser retains credit',async()=>{
   const results=await Promise.all([rpc('portal_book_class',args(slots[2]),sessionA.access_token),rpc('portal_book_class',args(slots[2]),sessionB.access_token)]);
   assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).body.message,'SLOT_UNAVAILABLE');
   const loser=results[0].ok?sessionB:sessionA;
   assert.equal((await rpc('portal_my_data',{},loser.access_token)).body.credits.available,1);
   winner=results.find(r=>r.ok).body;
  });
  await t.test('expired credit rejected; failed booking leaves no row/allocation',async()=>{
   // Return both accounts to available state, then expire B's own technical unit.
   assert.equal((await rpc('credit_resolve_booking',{p_booking_id:winner.id,p_reason:'teacher_cancel',p_request_id:randomUUID()})).ok,true);
   await query(`update booking_private.credits set expires_at=now()-interval '1 second' where purchase_id in(select id from booking_private.purchases where student_id='${students[1]}')`);
   const attempt=args(slots[3]);assert.equal((await rpc('portal_book_class',attempt,sessionB.access_token)).body.message,'NO_AVAILABLE_CREDITS');
   assert.equal(Number((await query(`select count(*) as n from booking_private.bookings where request_id='${attempt.p_request_id}'`))[0].n),0);
  });
  await t.test('guest Edge booking stays independent, prices unchanged',async()=>{
   const payload={type:'1a1',plan:4,slotId:slots[4],requestId:randomUUID(),timezone:'UTC',language:'es',student:{name:'Phase2D guest',email:`${students[2]}@example.invalid`,phone:'',language:'es',country:'',spanishLevel:'',message:''}};
   const response=await fetch(url+'/functions/v1/booking-create',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:4181'},body:JSON.stringify(payload)});
   assert.equal(response.ok,true);const receipt=await response.json();assert.equal(receipt.price,230);
   assert.equal((await query(`select student_id is null as guest from booking_private.bookings where request_id='${payload.requestId}'`))[0].guest,true);
  });
  await t.test('browser with real SDK/Auth books and refreshes upcoming classes', {skip:!process.env.PLAYWRIGHT_MODULE},async()=>{
   const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
   const browser=await chromium.launch({channel:'chrome',headless:true});
   try {
    const context=await browser.newContext({timezoneId:'Europe/Warsaw',viewport:{width:390,height:1000}});
    await context.addInitScript(session=>localStorage.setItem('sebaspanish-development-auth',JSON.stringify(session)),sessionA);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4181/sebaspanishv2/mis-clases.html');
    await page.locator('#portal-content:not([hidden])').waitFor();await page.locator('#portal-book-start').click();
    const availability=await rpc('portal_booking_slots',{},sessionA.access_token);
    const selected=availability.body.slots.find(s=>s.id===slots[5]);assert.ok(selected);
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(selected.startAt));
    await page.locator('#portal-book-day option').nth(1).waitFor({state:'attached'});
    await page.selectOption('#portal-book-day',day);await page.selectOption('#portal-book-slot',slots[5]);
    await page.locator('#portal-book-confirm').click();await page.locator('#portal-book-status').filter({hasText:'Tu clase está confirmada'}).waitFor();
    assert.equal(await page.locator('#portal-upcoming li').count(),1);assert.equal(await page.locator('#credits-available').textContent(),'0');
    assert.deepEqual(errors,[]);await context.close();
   }finally{await browser.close();}
  });
  // Full late-cancel/no-show/teacher-expiry coverage remains in the unchanged SQL regression suite.
  await t.test('previous SQL cancellation and portal suites on Development roll back cleanly',async()=>{
   for(const file of ['credits.sql','portal.sql','portal-data.sql']) await query(await readFile(join(root,'supabase/tests',file),'utf8'));
  });
 }finally{
  // Exact IDs only; preserve every pre-existing customer, booking and availability row.
  if(serverKey){
   await query(`begin;
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
  serverKey=undefined;sessionA=undefined;sessionB=undefined;await rm(folder,{recursive:true,force:true});
 }
});
