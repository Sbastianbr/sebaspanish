import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {copy} from '../../portal-i18n.js';
test('credit booking UI: ES/EN/PL, responsive, conflict and lost response', {skip:!process.env.PLAYWRIGHT_MODULE,timeout:180000},async()=>{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const output=process.env.PORTAL_TEST_ARTIFACTS||'/private/tmp/seba-phase2d/browser';mkdirSync(output,{recursive:true});
 const origin='http://127.0.0.1:4181',api='https://vvvugnkvtkcfuwxroies.supabase.co';
 const uid='f07b2a40-e6bf-4b7d-822e-2c0c1531d100';
 const jwt=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
 const user={id:uid,aud:'authenticated',role:'authenticated',email:'phase2d@example.invalid',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
 try {for(const width of [360,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'Europe/Warsaw',reducedMotion:'reduce'});
  let data={profile:{name:'Alumno técnico',email:user.email,language:'es'},credits:{available:3,reserved:0,consumed:0,expired:0},purchases:[],upcoming:[],history:[]};
  const slots=[{id:'00000000-0000-4000-8000-000000000001',startAt:'2026-11-10T12:00:00Z',endAt:'2026-11-10T13:00:00Z'},
   {id:'00000000-0000-4000-8000-000000000002',startAt:'2026-11-11T12:00:00Z',endAt:'2026-11-11T13:00:00Z'}];
  let mode='success',attempts=[];
  await context.route(api+'/**',async route=>{
   const path=new URL(route.request().url()).pathname;let body={},status=200;
   if(path.endsWith('/user'))body=user;
   else if(path.endsWith('/token'))body={access_token:jwt,refresh_token:'fixture',expires_in:3600,token_type:'bearer',user};
   else if(path.endsWith('/portal_current_access'))body=true;
   else if(path.endsWith('/portal_my_data'))body=data;
   else if(path.endsWith('/portal_booking_slots'))body={source:'live',slots};
   else if(path.endsWith('/portal_book_class')){
    const args=route.request().postDataJSON();attempts.push(args);
    assert.deepEqual(Object.keys(args).sort(),['p_request_id','p_slot_id','p_timezone']);
    if(mode==='conflict'){body={code:'P0001',message:'SLOT_UNAVAILABLE'};status=400;}
    else if(mode==='lost'){mode='success';await route.abort('failed');return;}
    else{const slot=slots.find(s=>s.id===args.p_slot_id);body={id:'booking',status:'confirmed',slotId:slot.id,startAt:slot.startAt,endAt:slot.endAt,timezone:args.p_timezone};
     data={...data,credits:{...data.credits,available:2,reserved:1},upcoming:[{startsAt:slot.startAt,endsAt:slot.endAt,durationMinutes:60,type:'1a1',status:'confirmed'}]};}
   } else if(path.endsWith('/logout')){status=204;}
   else throw Error('Unexpected endpoint '+path);
   await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin},body:status===204?'':JSON.stringify(body)});
  });
  await context.addInitScript(({jwt,user})=>localStorage.setItem('sebaspanish-development-auth',JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{jwt,user});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/sebaspanishv2/mis-clases.html');await page.locator('#portal-content:not([hidden])').waitFor();
  async function choose(){await page.locator('#portal-book-start').click();await page.locator('#portal-book-day option').nth(1).waitFor({state:'attached'});await page.selectOption('#portal-book-day',{index:1});await page.selectOption('#portal-book-slot',{index:1});}
  for(const lang of ['es','en','pl']){
   await page.locator('#languageButton').click();await page.locator(`[data-language="${lang}"]`).click();
   await choose();await page.locator('#portal-book-confirm').focus();assert.equal(await page.locator('#portal-book-confirm').evaluate(e=>e===document.activeElement),true);
   assert.equal(await page.locator('#portal-book-confirm').textContent(),copy[lang].bookConfirm);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`${output}/${width}-${lang}.png`});
   await page.locator('#portal-book-cancel').click();
  }
  mode='conflict';await choose();await page.locator('#portal-book-confirm').click();
  await page.getByText(copy.pl.bookTaken,{exact:true}).waitFor();
  assert.equal(await page.locator('#portal-book-confirm').isDisabled(),true);
  assert.equal(await page.locator('#credits-available').textContent(),'3');
  await page.selectOption('#portal-book-day',{index:1});await page.selectOption('#portal-book-slot',{index:1});
  mode='lost';await page.locator('#portal-book-confirm').click();await page.getByText(copy.pl.bookUncertain,{exact:true}).waitFor();
  assert.equal(await page.locator('#portal-book-day').isDisabled(),true);
  const lost=attempts.at(-1);await page.locator('#portal-book-confirm').click();
  await page.getByText(copy.pl.bookSuccess,{exact:true}).waitFor();assert.deepEqual(attempts.at(-1),lost);
  assert.equal(await page.locator('#portal-upcoming li').count(),1);
  assert.equal(await page.locator('#credits-available').textContent(),'2');
  assert.deepEqual(errors,[]);await context.close();console.log('PASS width',width,'ES/EN/PL + conflict + safe retry');
 }}finally{await browser.close();}
});
