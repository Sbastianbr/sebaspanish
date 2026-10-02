// Browser integration with the real pinned SDK and controlled HTTP responses.
// No requests reach Supabase; no emails or remote fixtures.
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import test from 'node:test';
// Optional browser suite; use an existing Playwright installation, no download/install.
test('private portal: SDK session, security, keyboard and responsive', { skip: !process.env.PLAYWRIGHT_MODULE }, async () => {
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const output = process.env.PORTAL_TEST_ARTIFACTS || '/private/tmp/sebaspanish-portal-qa';
mkdirSync(output, { recursive: true });
const site='http://127.0.0.1:4181/sebaspanishv2/';
const uid='f07b2a40-e6bf-4b7d-822e-2c0c1531d100';
const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,aud:'authenticated',role:'authenticated',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test-signature';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'phase2c-browser@example.invalid',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
const data={profile:{name:'Alumno de prueba',email:user.email,language:'es',country:'España',spanishLevel:'B1'},credits:{available:3,reserved:1,consumed:2,expired:1,returnedPendingReview:0,nextExpiry:'2027-03-29T12:00:00Z'},purchases:[{offer:'1a1-4',classCount:4,priceMinor:23000,currency:'PLN',createdAt:'2026-09-29T12:00:00Z',activatedAt:'2026-09-29T12:00:00Z',expiresAt:'2027-03-29T12:00:00Z',status:'active'}],upcoming:[{startsAt:'2026-10-06T14:00:00Z',endsAt:'2026-10-06T15:00:00Z',durationMinutes:60,type:'1a1',status:'confirmed'}],history:[{startsAt:'2026-09-28T14:00:00Z',endsAt:'2026-09-28T15:00:00Z',durationMinutes:60,type:'1a1',status:'completed'}]};
const browser=await chromium.launch({channel:'chrome',headless:true});const passed=[];
function check(name){passed.push(name);console.log('PASS: '+name);}
try {
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  let failData=false, failRefresh=false, logoutFails=false;
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://vvvugnkvtkcfuwxroies.supabase.co/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   let body={},status=200;
   if(path.endsWith('/user'))body=user;
   else if(path.endsWith('/token')) {body=failRefresh?{code:'refresh_token_not_found',msg:'Refresh token not found'}:{access_token:jwt,refresh_token:'technical-refresh',expires_in:3600,token_type:'bearer',user};status=failRefresh?400:200;}
   else if(path.endsWith('/logout')) {status=logoutFails?503:204;body={};}
   else if(path.endsWith('/portal_current_access'))body=true;
   else if(path.endsWith('/portal_my_data')) {body=failData?{code:'P0001',message:'technical private error'}:data;status=failData?500:200;}
   else if(path.endsWith('/portal-access-request'))body={ok:true};
   else throw Error('Unexpected mocked request path: '+path);
   await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:4181','x-supabase-api-version':'2024-01-01'},body:status===204?'':JSON.stringify(body)});
  });
  async function enter(){
    const fragment=new URLSearchParams({access_token:jwt,refresh_token:'technical-refresh',expires_in:'3600',token_type:'bearer',type:'invite'});
    await page.goto(site+'auth-callback.html#'+fragment);await page.waitForURL(site+'mis-clases.html');await page.locator('#portal-content').waitFor({state:'visible'});
  }
  await enter();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${output}/preview-${width}.png`,fullPage:true});
  assert.equal(await page.locator('header').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.keyboard.press('Tab');assert.ok(await page.locator(':focus-visible').count()>0);
  await page.locator('#languageButton').focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  check(`Clean layout, visible focus and keyboard language navigation at ${width}`);
  data.profile.name='<img src=x onerror=alert(1)> Long name '.repeat(5);
  await page.reload();await page.locator('#portal-content').waitFor({state:'visible'});
  assert.equal(await page.locator('#portal-greeting img').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  check(`Long untrusted profile text rendered as text with no overflow at ${width}`);
  data.profile.name='Alumno de prueba';
  failData=true;await page.reload();await page.locator('#portal-retry').waitFor({state:'visible'});
  assert.equal(await page.locator('#portal-content').isVisible(),false);assert.equal(await page.locator('#portal-profile').innerText(),'');
  assert.ok(!(await page.locator('body').innerText()).includes('technical private error'));
  failData=false;await page.locator('#portal-retry').click();await page.locator('#portal-content').waitFor({state:'visible'});
  check(`Backend failure clears private DOM, exposes no server details and allows retry at ${width}`);
  failRefresh=true;
  await page.clock.setFixedTime(new Date(Date.now()+2*3600*1000));
  await page.reload();
  await page.waitForURL('**/acceso.html?state=expired');
  assert.equal(await page.evaluate(()=>localStorage.getItem('sebaspanish-development-auth')),null);
  check(`Rejected refresh removes session and redirects to access at ${width}`);
  failRefresh=false;await page.clock.setFixedTime(new Date());await enter();logoutFails=true;
  await page.locator('#portal-logout').click();await page.waitForURL('**/acceso.html?state=loggedOut');
  assert.equal(await page.evaluate(()=>localStorage.getItem('sebaspanish-development-auth')),null);
  check(`Remote logout failure still clears official SDK session locally at ${width}`);
  assert.deepEqual(errors,[]);await context.close();
 }
 writeFileSync(`${output}/browser-mock-results.json`,JSON.stringify({passed},null,2));
}finally{await browser.close();}

});
