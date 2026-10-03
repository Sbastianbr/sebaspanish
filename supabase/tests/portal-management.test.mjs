import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortalSession} from '../../portal-session.js';
function setup(){
 let user='A',data,error,status=200;const calls=[];
 const client={auth:{getSession:async()=>({data:{session:{user:{id:user}}}}),getUser:async()=>({data:{user:{id:user}}})},
 rpc:(name,args)=>{calls.push({name,args});return {abortSignal:async()=>({data,error,status})}}};
 return {service:createPortalSession(client),calls,set(d,e=null,s=200){data=d;error=e;status=s;},user(id){user=id;}};
}
const cancelled={action:'cancel',bookingId:'old',status:'cancelled',creditOutcome:'returned',replacement:null};
const moved={action:'reschedule',bookingId:'old',status:'rescheduled',creditOutcome:'returned',replacement:{id:'new',slotId:'slot'}};
test('cancel sends only own booking reference, attempt and explicit loss consent',async()=>{
 const x=setup();x.set(cancelled);assert.deepEqual(await x.service.cancelClass('old'),cancelled);
 assert.equal(x.calls[0].name,'portal_cancel_class');assert.deepEqual(Object.keys(x.calls[0].args).sort(),['p_accept_credit_loss','p_booking_id','p_request_id']);
 assert.equal(x.calls[0].args.p_accept_credit_loss,false);
});
test('lost reschedule response preserves request; no client-selected credit or identity',async()=>{
 const x=setup();x.set(null,{code:'FETCH_ERROR'});await assert.rejects(x.service.rescheduleClass('old','slot','UTC'));
 x.set(moved);await x.service.rescheduleClass('old','slot','UTC');assert.deepEqual(x.calls[0],x.calls[1]);
 assert.deepEqual(Object.keys(x.calls[0].args).sort(),['p_accept_credit_loss','p_booking_id','p_request_id','p_slot_id','p_timezone']);
});
test('owner, selection, action or consent change gets separate attempt',async()=>{
 const x=setup();x.set(null,{code:'FETCH_ERROR'});
 await assert.rejects(x.service.cancelClass('old'));await assert.rejects(x.service.cancelClass('old',true));
 x.user('B');await assert.rejects(x.service.cancelClass('old',true));
 await assert.rejects(x.service.rescheduleClass('old','slot','UTC',true));
 assert.equal(new Set(x.calls.map(c=>c.args.p_request_id)).size,4);
});
test('management errors remain stable; internals stay private',async()=>{
 const x=setup();for(const code of ['BOOKING_NOT_FOUND','BOOKING_ALREADY_CANCELLED','BOOKING_NOT_UPCOMING','BOOKING_NOT_MANAGEABLE','CREDIT_LOSS_CONFIRMATION_REQUIRED','SAME_SLOT']){
  x.set(null,{code:'P0001',message:code},400);await assert.rejects(x.service.cancelClass('old'),{code});
 }
 x.set(null,{code:'XX000',message:'private row details'},500);await assert.rejects(x.service.cancelClass('old'),{message:'UNAVAILABLE'});
});
test('malformed receipt cannot announce success or reset a retry',async()=>{
 const x=setup();x.set({...cancelled,bookingId:'other'});await assert.rejects(x.service.cancelClass('old'),{code:'UNAVAILABLE'});
 x.set(cancelled);await x.service.cancelClass('old');assert.equal(x.calls[0].args.p_request_id,x.calls[1].args.p_request_id);
});
