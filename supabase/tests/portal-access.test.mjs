import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccessProcessor, createPortalAuth, createPortalHandler, createEmailHash, normalizeAccessRequest } from '../functions/_shared/portal.mjs';
const studentId = '10000000-0000-4000-8000-000000000001';
const authId = '20000000-0000-4000-8000-000000000001';
const email = 'allowed@example.invalid';
const origin = 'http://127.0.0.1:4181';
function fixture({ eligible = true, linked = null, limited = false, failCreate = false, failSend = false, allowlist = [email] } = {}) {
  const calls = []; const jobs = []; const errors = []; let identity = linked;
  const rpc = async (name, args) => {
    calls.push([name,args]);
    if (name === 'portal_request_claim') return !limited;
    if (name === 'portal_access_eligibility') return eligible ? [{ student_id:studentId,normalized_email:email,auth_user_id:identity }] : [];
    if (name === 'portal_auth_link') { if(args.p_auth_user_id) identity=args.p_auth_user_id; return identity; }
    throw Error('unexpected RPC');
  };
  const auth = { async inviteIdentity() { calls.push(['invite']); identity=authId; if(failCreate) throw Error('response lost'); return authId; },
    async sendMagicLink() { calls.push(['send']); if(failSend) throw Error('private diagnostics'); } };
  const processAccess = createAccessProcessor({rpc,auth,hashEmail:async()=> 'a'.repeat(64),deliveryAllowlist:allowlist});
  const handler = createPortalHandler({origins:[origin,'https://production.invalid'],processAccess,
    defer:job=>jobs.push(job),reportFailure:code=>errors.push(code)});
  return { handler,calls,errors,finish:()=>Promise.all(jobs) };
}
function request(body={email}, extra={}) { return new Request('https://api.invalid/access',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body),...extra}); }

for (const state of ['nonexistent','without-purchase','pending','trial-only','active']) {
  test(`${state}: identical response without personal data`,async()=>{
    const f=fixture({eligible:state==='active'}); const response=await f.handler(request());
    assert.equal(response.status,200); assert.equal(await response.text(),'{"ok":true}');
    await f.finish(); assert.equal(f.calls.some(([name])=>name==='invite'),state==='active');
    assert.equal(f.calls.some(([name])=>name==='send'),false);
  });
}
test('strict normalized email input and extra fields rejected',()=>{
  assert.equal(normalizeAccessRequest({email:' ALLOWED@Example.INVALID '}),email);
  for(const body of [null,[],{},'email',{email:'bad'},{email,student_id:studentId},{email:'a\n@x.io'},{email:'a'.repeat(255)}]) {
    assert.throws(()=>normalizeAccessRequest(body));
  }
});
test('eligible first invitation binds the returned identity without duplicate email',async()=>{
  const f=fixture(); await f.handler(request({email:' ALLOWED@EXAMPLE.INVALID '})); await f.finish();
  assert.deepEqual(f.calls.map(([name])=>name),['portal_request_claim','portal_access_eligibility','portal_auth_link','invite','portal_auth_link']);
  assert.deepEqual(f.calls[4][1],{p_student_id:studentId,p_auth_user_id:authId});
});
test('already linked identity is reused without creation',async()=>{
  const f=fixture({linked:authId}); await f.handler(request()); await f.finish();
  assert.equal(f.calls.some(([name])=>name==='invite'),false); assert.equal(f.calls.at(-1)[0],'send');
});
test('lost invitation response recovers identity without sending again',async()=>{
  const f=fixture({failCreate:true}); await f.handler(request()); await f.finish(); assert.equal(f.calls.at(-1)[0],'portal_auth_link');
});
test('development delivery allowlist prevents accidental Auth creation and mail',async()=>{
  const f=fixture({allowlist:[]}); await f.handler(request()); await f.finish(); assert.equal(f.calls.length,2);
});
test('throttled request is generic and never calls eligibility/Auth',async()=>{
  const f=fixture({limited:true}); const response=await f.handler(request()); await f.finish();
  assert.equal(response.status,200); assert.deepEqual(await response.json(),{ok:true}); assert.equal(f.calls.length,1);
});
test('Auth failures are not exposed and diagnostic is constant',async()=>{
  const f=fixture({failSend:true,linked:authId}); const response=await f.handler(request()); await f.finish();
  assert.deepEqual(await response.json(),{ok:true}); assert.deepEqual(f.errors,['PORTAL_ACCESS_FAILED']);
});
test('link conflict does not send, rebind or expose reason',async()=>{
  let sent=false; const jobs=[];
  const processAccess=createAccessProcessor({rpc:async(name)=>{
    if(name==='portal_request_claim') return true;
    if(name==='portal_access_eligibility') return [{student_id:studentId,normalized_email:email}];
    throw Error('AUTH_LINK_CONFLICT');
  },auth:{sendMagicLink:()=>{sent=true;}},hashEmail:async()=> 'a'.repeat(64),deliveryAllowlist:[email]});
  const handler=createPortalHandler({origins:[origin],processAccess,defer:p=>jobs.push(p)});
  assert.deepEqual(await (await handler(request())).json(),{ok:true}); await Promise.all(jobs); assert.equal(sent,false);
});
test('response does not wait for eligibility or email result',async()=>{
  let resolve; const pending=new Promise(r=>{resolve=r;}); const jobs=[];
  const handler=createPortalHandler({origins:[origin],processAccess:()=>pending,defer:p=>jobs.push(p)});
  const response=await handler(request()); assert.deepEqual(await response.json(),{ok:true}); resolve(); await Promise.all(jobs);
});
test('CORS denied for missing, arbitrary and production origin',async()=>{
  for(const bad of ['', 'https://attacker.invalid','https://production.invalid']) {
    const f=fixture(); const response=await f.handler(request({email},{headers:{Origin:bad,'Content-Type':'application/json'}}));
    assert.equal(response.status,403); assert.equal(response.headers.get('access-control-allow-origin'),null); assert.equal(f.calls.length,0);
  }
});
test('preflight, methods, JSON parsing and streaming byte limit',async()=>{
  const f=fixture(); assert.equal((await f.handler(new Request('https://api.invalid',{method:'OPTIONS',headers:{Origin:origin}}))).status,204);
  assert.equal((await f.handler(new Request('https://api.invalid',{headers:{Origin:origin}}))).status,405);
  assert.equal((await f.handler(request({}, {body:'{'}))).status,400);
  assert.equal((await f.handler(request({}, {headers:{Origin:origin,'Content-Type':'text/plain'}}))).status,415);
  assert.equal((await f.handler(request({email:'a'.repeat(17000)}))).status,413);
  assert.equal(f.calls.length,0);
});
test('email HMAC is stable, secret-specific and excludes raw email',async()=>{
  const hash=createEmailHash('secret-'.repeat(8)); const value=await hash(email);
  assert.match(value,/^[a-f0-9]{64}$/); assert.equal(value,await hash(email));
  assert.notEqual(value,await createEmailHash('different-'.repeat(8))(email));
  await assert.rejects(createEmailHash('')(email));
});
for (const confirmed of [false,true]) {
  test(`Auth REST: ${confirmed ? 'confirmed identity receives OTP without signup' : 'first access receives invitation without auto-confirmation'}`,async()=>{
    const calls=[]; const auth=createPortalAuth({url:'https://dev.invalid',serverKey:'server',publicKey:'public',
      redirectUrl:`${origin}/sebaspanishv2/auth-callback.html`,fetchImpl:async(url,options)=>{
        calls.push({url,...options,body:options.body ? JSON.parse(options.body) : undefined});
        return Response.json({id:authId,email,email_confirmed_at:confirmed?'2026-01-01T00:00:00Z':null});
      }});
    assert.equal(await auth.inviteIdentity(email),authId); await auth.sendMagicLink(email,authId);
    assert.deepEqual(calls[0].body,{email}); assert.equal(new URL(calls[0].url).pathname,'/auth/v1/invite'); assert.equal(calls[0].headers.apikey,'server');
    assert.equal(calls[1].method,'GET'); assert.equal(calls[1].url,`https://dev.invalid/auth/v1/admin/users/${authId}`);
    assert.deepEqual(calls[2].body,confirmed?{email,create_user:false}:{email});
    assert.equal(calls[2].headers.apikey,confirmed?'public':'server');
    assert.equal(new URL(calls[2].url).pathname,confirmed?'/auth/v1/otp':'/auth/v1/invite');
    assert.equal(new URL(calls[2].url).searchParams.get('redirect_to'),`${origin}/sebaspanishv2/auth-callback.html`);
    await assert.rejects(createPortalAuth({redirectUrl:'https://attacker.invalid'}).sendMagicLink(email,authId));
  });
}
test('Auth send rechecks identity email before any delivery',async()=>{
  let count=0;const auth=createPortalAuth({url:'https://dev.invalid',serverKey:'server',publicKey:'public',redirectUrl:`${origin}/sebaspanishv2/auth-callback.html`,
    fetchImpl:async()=>{count++;return Response.json({id:authId,email:'other@example.invalid'});}});
  await assert.rejects(auth.sendMagicLink(email,authId));assert.equal(count,1);
});
