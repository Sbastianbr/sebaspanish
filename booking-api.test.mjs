import test from 'node:test';
import assert from 'node:assert/strict';
import { createBookingApi } from './booking-api.js';
import { createHandler, createRpc, BookingError, validateBooking } from './supabase/functions/_shared/booking.mjs';

const slot = {id:'10000000-0000-4000-8000-000000000001',startAt:new Date(Date.now()+3*86400000).toISOString()};
slot.endAt = new Date(Date.parse(slot.startAt)+3600000).toISOString();
const student = {name:' Test ',email:'test@example.com',phone:'',country:'',message:'',spanishLevel:'B1',language:'es'};
const payload = () => ({type:'1a1',plan:4,slotId:slot.id,requestId:crypto.randomUUID(),timezone:'Europe/Warsaw',language:'es',student:{...student}});
const origin = 'https://sbastianbr.github.io';
const req = (body, options={}) => new Request('https://example.invalid/booking-create', {
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body),...options,
});
const state = {type:'1a1',plan:4,date:'2030-01-01',startAt:slot.startAt,timezone:'Europe/Warsaw',student};
const availability = {source:'live',slots:new Map([[state.date,[slot]]])};
const config = {mode:'supabase',functionsUrl:'https://example.invalid/functions/v1'};
const receipt = {id:'receipt',status:'confirmed',type:'1a1',plan:4,slotId:slot.id,startAt:slot.startAt,endAt:slot.endAt,timezone:state.timezone,price:230,currency:'PLN',sessions:4,durationMinutes:60};

test('server accepts all approved plans and languages, normalizes contact data', () => {
  for (const language of ['es','en','pl']) for (const plan of [1,4,8]) {
    const result=validateBooking({...payload(),plan,language});
    assert.equal(result.student.name,'Test'); assert.equal(result.language,language);
  }
  assert.equal(validateBooking({...payload(),type:'prueba',plan:null}).type,'prueba');
});
test('server rejects tampering, unknown plans, DELE and incomplete data', () => {
  const invalid=[{plan:3},{plan:'4'},{type:'dele'},{price:0},{status:'confirmed'},{timezone:'bad'},
    {language:'xx'},{requestId:'bad'},{student:{...student,name:''}},{student:{...student,email:'bad'}},
    {student:{...student,language:'xx'}},{student:{...student,message:'x'.repeat(1501)}}];
  for (const fields of invalid) assert.throws(()=>validateBooking({...payload(),...fields}),BookingError);
});
test('availability exposes only fixed RPC arguments, no private booking query', async () => {
  const handler=createHandler({action:'availability',origins:[origin],rpc:async(name,args)=>{
    assert.equal(name,'booking_available_slots');assert.deepEqual(args,{p_type:'1a1',p_plan:4});
    return {source:'live',slots:[slot]};
  }});
  const response=await handler(req({type:'1a1',plan:4}));
  assert.equal(response.status,200); assert.equal((await response.json()).slots.length,1);
});
test('creation invokes one transaction with validated payload',async()=>{
  const handler=createHandler({action:'create',origins:[origin],rpc:async(name,args)=>{
    assert.equal(name,'booking_create'); assert.equal(args.p_payload.student.name,'Test');return receipt;
  }});
  assert.deepEqual(await (await handler(req(payload()))).json(),receipt);
});
test('controlled occupied-slot error and rate limit are returned without SQL details',async()=>{
  for (const [code,status] of [['SLOT_UNAVAILABLE',409],['RATE_LIMITED',429]]) {
    const handler=createHandler({action:'create',origins:[origin],rpc:async()=>{throw new BookingError(code,status);}});
    const response=await handler(req(payload()));assert.equal(response.status,status);
    assert.deepEqual(await response.json(),{error:{code}});
  }
});
test('bad origin, method, JSON and oversized body never call the database',async()=>{
  let calls=0;
  const handler=createHandler({action:'create',origins:[origin],rpc:async()=>{calls++;}});
  const requests=[req(payload(),{headers:{Origin:'https://evil.invalid','Content-Type':'application/json'}}),
    new Request('https://example.invalid',{method:'GET',headers:{Origin:origin}}),
    req(null,{body:'{'}),req(null,{body:'x'.repeat(17000)})];
  const expected=[403,405,400,413];
  for(let i=0;i<requests.length;i++)assert.equal((await handler(requests[i])).status,expected[i]);
  assert.equal(calls,0);
  assert.equal((await handler(new Request('https://example.invalid',{method:'OPTIONS',headers:{Origin:origin}}))).status,204);
});
test('RPC failures never expose database details or secrets',async()=>{
  const rpc=createRpc({url:'https://example.invalid',key:'test-only',fetchImpl:async()=>Response.json({code:'23505',message:'PRIVATE SQL DETAILS'},{status:400})});
  await assert.rejects(rpc('booking_create',{}),{code:'SERVER_ERROR'});
});
test('unconfigured demo makes no network requests and keeps explicit unconnected state',async()=>{
  const api=createBookingApi({mode:'demo',functionsUrl:''},()=>{throw Error('network should not run');});
  assert.equal(api.isLive,false);
  assert.equal((await api.getAvailableSlots({...state,availabilitySource:'unconnected'})).slots.size,0);
  const demoState={...state,availabilitySource:'demo'};
  const demo=await api.getAvailableSlots(demoState);
  const [date,slots]=[...demo.slots][0];
  const draft=await api.createBooking({...demoState,date,startAt:slots[0].startAt},demo,'es');
  assert.equal(draft.status,'draft_local');
});
test('live availability and network errors never activate demo',async()=>{
  const api=createBookingApi(config,async()=>Response.json({source:'live',slots:[slot]}));
  assert.equal((await api.getAvailableSlots(state)).source,'live');
  await assert.rejects(createBookingApi(config,async()=>{throw Error('offline');}).getAvailableSlots(state),{code:'NETWORK_ERROR'});
  await assert.rejects(createBookingApi({mode:'supabase',functionsUrl:''}).getAvailableSlots(state),{code:'CONFIGURATION_ERROR'});
});
test('retry after lost response keeps request ID and original language',async()=>{
  const sent=[];
  const api=createBookingApi(config,async(url,options)=>{
    sent.push(JSON.parse(options.body));if(sent.length===1)throw Error('response lost');return Response.json(receipt);
  });
  await assert.rejects(api.createBooking(state,availability,'es'),{code:'NETWORK_ERROR'});
  assert.equal((await api.createBooking(state,availability,'pl')).status,'confirmed');
  assert.deepEqual(sent[0],sent[1]);
  assert.ok(!Object.hasOwn(sent[0],'price'));assert.ok(!Object.hasOwn(sent[0],'startAt'));
});
test('double click uses same idempotency key; a changed request gets a new key',async()=>{
  const keys=[];
  const api=createBookingApi(config,async(url,options)=>{keys.push(JSON.parse(options.body).requestId);return Response.json(receipt);});
  await Promise.all([api.createBooking(state,availability,'es'),api.createBooking(state,availability,'es')]);
  assert.equal(keys[0],keys[1]);
  await api.createBooking({...state,student:{...student,name:'Other'}},availability,'es');
  assert.notEqual(keys[0],keys[2]);
});
test('slot conflict propagates to UI and a malformed success is rejected',async()=>{
  await assert.rejects(createBookingApi(config,async()=>Response.json({error:{code:'SLOT_UNAVAILABLE'}},{status:409})).createBooking(state,availability,'en'),{code:'SLOT_UNAVAILABLE'});
  await assert.rejects(createBookingApi(config,async()=>Response.json({status:'confirmed'})).createBooking(state,availability,'en'),{code:'INVALID_RESPONSE'});
});

test('PostgreSQL exclusion violation 23P01 becomes HTTP 409 without private details', async () => {
  const rpc = createRpc({url:'https://example.invalid',key:'test-only',fetchImpl:async()=>
    Response.json({code:'23P01',message:'PRIVATE CONSTRAINT DETAILS'},{status:400})});
  const handler = createHandler({action:'create',origins:[origin],rpc});
  const response = await handler(req(payload()));
  assert.equal(response.status,409);
  assert.deepEqual(await response.json(),{error:{code:'SLOT_UNAVAILABLE'}});
});
