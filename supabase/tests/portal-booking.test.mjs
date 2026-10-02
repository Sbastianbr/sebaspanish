import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortalSession} from '../../portal-session.js';
function setup() {
 let user='A',response,error,status=200;const calls=[];
 const client={auth:{getSession:async()=>({data:{session:{user:{id:user}}}}),getUser:async()=>({data:{user:{id:user}}})},
  rpc:(name,args)=>{calls.push({name,args});return {abortSignal:async()=>({data:response,error,status})}}};
 return {service:createPortalSession(client),calls,set(value,err=null,code=200){response=value;error=err;status=code},user(id){user=id}};
}
const slot='00000000-0000-4000-8000-000000000001';
const receipt={id:'lesson',status:'confirmed',slotId:slot,timezone:'UTC',startAt:'2026-12-01T12:00:00Z'};
test('portal availability reuses live server data with no selected identity',async()=>{
 const s=setup();s.set({source:'live',slots:[]});assert.deepEqual(await s.service.availableSlots(),[]);
 assert.deepEqual(s.calls,[{name:'portal_booking_slots',args:{}}]);
 s.set({source:'demo',slots:[]});await assert.rejects(s.service.availableSlots(),{code:'UNAVAILABLE'});
});
test('uncertain retry keeps request ID, sending only slot/request/timezone',async()=>{
 const s=setup();s.set(null,{code:'FETCH_ERROR',message:'private data'},0);
 await assert.rejects(s.service.bookClass(slot,'UTC'),{code:'UNAVAILABLE'});
 s.set(receipt);await s.service.bookClass(slot,'UTC');
 assert.deepEqual(s.calls[0].args,s.calls[1].args);
 assert.deepEqual(Object.keys(s.calls[0].args).sort(),['p_request_id','p_slot_id','p_timezone']);
 assert.match(s.calls[0].args.p_request_id,/^[a-f0-9-]{36}$/);
});
test('server business errors remain stable, unknown details stay private',async()=>{
 const s=setup();for(const code of ['NO_AVAILABLE_CREDITS','SLOT_UNAVAILABLE','BOOKING_TOO_SOON','INVALID_SLOT','IDEMPOTENCY_CONFLICT','STUDENT_NOT_FOUND']){
  s.set(null,{code:'P0001',message:code},400);await assert.rejects(s.service.bookClass(slot,'UTC'),{code});
 }
 s.set(null,{code:'XX000',message:'private credit data'},500);await assert.rejects(s.service.bookClass(slot,'UTC'),{code:'UNAVAILABLE',message:'UNAVAILABLE'});
});
test('changed selection or account gets a separate attempt; success clears it',async()=>{
 const s=setup();s.set(null,{code:'FETCH_ERROR'},0);
 await assert.rejects(s.service.bookClass(slot,'UTC'));s.user('B');await assert.rejects(s.service.bookClass(slot,'UTC'));
 assert.notEqual(s.calls[0].args.p_request_id,s.calls[1].args.p_request_id);
 s.set(receipt);await s.service.bookClass(slot,'UTC');await s.service.bookClass(slot,'UTC');
 assert.notEqual(s.calls.at(-1).args.p_request_id,s.calls.at(-2).args.p_request_id);
});
