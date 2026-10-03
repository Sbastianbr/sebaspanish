import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {copy} from '../../portal-i18n.js';
test('lesson management UI: translations, responsive, confirmation, failures and safe retry', {skip:!process.env.PLAYWRIGHT_MODULE,timeout:180000},async()=>{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const output=process.env.PORTAL_TEST_ARTIFACTS||'/private/tmp/seba-phase2e/browser';mkdirSync(output,{recursive:true});
 const origin='http://127.0.0.1:4181',api='https://vvvugnkvtkcfuwxroies.supabase.co';
 const uid='f07b2a40-e6bf-4b7d-822e-2c0c1531d100';
 const jwt=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
 const user={id:uid,aud:'authenticated',role:'authenticated',email:'phase2d@example.invalid',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
 try {for(const width of [360,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'Europe/Warsaw',reducedMotion:'reduce'});
  const lesson={id:'old',startsAt:'2030-11-10T12:00:00Z',endsAt:'2030-11-10T13:00:00Z',durationMinutes:60,type:'1a1',status:'confirmed',manageable:true};
  const slot={id:'new-slot',startAt:'2030-11-11T12:00:00Z',endAt:'2030-11-11T13:00:00Z'};
  let data={profile:{name:'Alumno técnico',email:user.email,language:'es'},credits:{available:2,reserved:1,consumed:0,expired:0},purchases:[],upcoming:[lesson],history:[]};
  let mode='success',attempts=[],receipts=new Map();
  await context.route(api+'/**',async route=>{
   const path=new URL(route.request().url()).pathname;let body={},status=200;
   if(path.endsWith('/user'))body=user;
   else if(path.endsWith('/token'))body={access_token:jwt,refresh_token:'fixture',expires_in:3600,token_type:'bearer',user};
   else if(path.endsWith('/portal_current_access'))body=true;
   else if(path.endsWith('/portal_my_data'))body=data;
   else if(path.endsWith('/portal_booking_slots'))body={source:'live',slots:[slot]};
   else if(/portal_(cancel|reschedule)_class$/.test(path)){
    const args=route.request().postDataJSON();attempts.push(args);
    if(mode==='conflict'){body={code:'P0001',message:'SLOT_UNAVAILABLE'};status=400;}
    else if(mode==='boundary'){mode='success';body={code:'P0001',message:'CREDIT_LOSS_CONFIRMATION_REQUIRED'};status=400;}
    else {
     const action=path.endsWith('reschedule_class')?'reschedule':'cancel';
     body=receipts.get(args.p_request_id)||{action,bookingId:args.p_booking_id,status:action==='cancel'?'cancelled':'rescheduled',creditOutcome:args.p_accept_credit_loss?'consumed':'returned',replacement:action==='reschedule'?{id:'new',slotId:slot.id}:null};
     receipts.set(args.p_request_id,body);
     data={...data,credits:{...data.credits,reserved:action==='cancel'?0:1},upcoming:action==='cancel'?[]:[{...lesson,id:'new',startsAt:slot.startAt,endsAt:slot.endAt}],history:[{...lesson,status:body.status,manageable:false}]};
     if(mode==='lost'){mode='success';await route.abort('failed');return;}
    }
   }else throw Error('Unexpected '+path);
   await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin},body:JSON.stringify(body)});
  });
  await context.addInitScript(({jwt,user})=>localStorage.setItem('sebaspanish-development-auth',JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{jwt,user});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/sebaspanishv2/mis-clases.html');await page.locator('#portal-content:not([hidden])').waitFor();
  async function openMove(){await page.locator('[data-manage-action="reschedule"]').click();await page.locator('#portal-manage-day option').nth(1).waitFor({state:'attached'});await page.selectOption('#portal-manage-day',{index:1});await page.selectOption('#portal-manage-slot',{index:1});}
  for(const lang of ['es','en','pl']){
   await page.locator('#languageButton').click();await page.locator(`[data-language="${lang}"]`).click();
   await page.locator('[data-manage-action="cancel"]').focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('#portal-manage-title').textContent(),copy[lang].manageCancelTitle);
   assert.equal(attempts.length,0,'opening confirmation sends no mutation');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#portal-manage-form').isHidden(),true);
   await openMove();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.locator('#portal-manage-form').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/${width}-${lang}.png`});
   await page.locator('#portal-manage-close').click();
  }
  mode='conflict';await openMove();await page.locator('#portal-manage-confirm').click();
  await page.getByText(copy.pl.manageTaken,{exact:true}).waitFor();assert.equal(data.upcoming[0].id,'old');
  assert.equal(await page.locator('#portal-manage-confirm').isDisabled(),true);
  await page.selectOption('#portal-manage-day',{index:1});await page.selectOption('#portal-manage-slot',{index:1});
  mode='lost';await page.locator('#portal-manage-confirm').click();await page.getByText(copy.pl.manageUncertain,{exact:true}).waitFor();
  assert.equal(await page.locator('#portal-manage-close').isDisabled(),true);
  const lost=attempts.at(-1);await page.locator('#portal-manage-confirm').click();await page.getByText(copy.pl.manageMoved,{exact:true}).waitFor();
  assert.deepEqual(attempts.at(-1),lost);assert.equal(await page.locator('#portal-history li').count(),1);
  mode='boundary';await page.locator('[data-manage-action="cancel"]').click();await page.locator('#portal-manage-confirm').click();
  await page.getByText(copy.pl.manageBoundary,{exact:true}).waitFor();assert.equal(data.upcoming.length,1);
  await page.locator('#portal-manage-confirm').click();await page.getByText(copy.pl.manageCancelledConsumed,{exact:true}).waitFor();
  assert.equal(attempts.at(-1).p_accept_credit_loss,true);assert.equal(await page.locator('#portal-upcoming li').count(),0);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS',width,'ES/EN/PL; keyboard; conflict; committed-response loss; renewed late consent');
 }}finally{await browser.close();}
});
