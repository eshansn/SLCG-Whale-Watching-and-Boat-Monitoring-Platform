// Runs only against the disposable SQL/API harness created by SupportTests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.WWMS_WEB_URL.replace(/\/$/, '');
const output = '.runlogs/support-center/browser';
const portals = [['Admin','/admin'],['BoatOwner','/owner/settings'],['BoatCrew','/crew/settings'],['OPS','/ops'],['ShoreCrew','/shore/settings'],['Supervisor','/supervisor'],['SLTDA','/sltda'],['Wildlife','/wildlife'],['ShoreWildlife','/shore-wildlife'],['HarbourOfficer','/harbour-officer'],['Passenger','/passenger']];
async function fill(page, message='Support fixture: GPS tracking is unavailable.') {
 await page.getByLabel('Full Name *',{exact:true}).fill('Support browser fixture');
 await page.getByLabel('Email Address *',{exact:true}).fill('browser@example.test');
 await page.getByLabel('Subject *',{exact:true}).fill('Support fixture');
 await page.getByLabel('Issue Category *',{exact:true}).selectOption('GPS & Tracking Issues');
 await page.getByLabel('Message / Description *',{exact:true}).fill(message);
}
(async () => {
 fs.mkdirSync(output,{recursive:true});
 const engine = process.env.PLAYWRIGHT_ENGINE === 'webkit' ? webkit : chromium;
 const browser = await engine.launch(engine === chromium ? {channel:'msedge',headless:true} : {headless:true});
 try {
  for (const [role,path] of portals) {
   const context = await browser.newContext({viewport:{width:1280,height:900}});
   const login = await context.request.post(base+'/api/auth/login',{data:{email:role.toLowerCase()+'@complaint-test.example',password:'BrowserTest#2026!Only'}});
   assert.equal(login.status(),200,'Real login for '+role);
   const auth = await login.json();
   await context.addInitScript(token => { if(!sessionStorage.getItem('whale-watching-refresh-token')) sessionStorage.setItem('whale-watching-refresh-token',token); },auth.refreshToken);
   const page=await context.newPage(); await page.goto(base+path);
   const link=role==='BoatOwner' ? page.getByRole('button',{name:/Need Help/}) : page.getByRole('link',{name:'Need Help? Contact our support center',exact:true});
   await link.waitFor(); await link.click();
   await page.waitForURL('**/support?from=*');
   await page.getByRole('heading',{name:'How Can We Help You?',exact:true}).waitFor();
   assert.equal(await page.getByLabel('Portal / User Type *',{exact:true}).inputValue(),role,'Prefilled '+role);
   assert.equal(await page.getByLabel('Email Address *',{exact:true}).inputValue(),role.toLowerCase()+'@complaint-test.example');
   await page.getByRole('link',{name:/Back to .*Portal/}).click();
   await page.waitForURL(base+path);
   await context.close(); console.log('PASS support link and return/auth preservation: '+role);
  }
  for(const width of [375,1440]) {
   const context=await browser.newContext({viewport:{width,height:width<768?844:960},reducedMotion:'reduce'});
   const page=await context.newPage(); await page.goto(base+'/support?from=https://untrusted.example/');
   assert.equal(await page.getByRole('link',{name:'Back to home',exact:true}).getAttribute('href'),'/','Unsafe return destinations are rejected');
   const questions=page.locator('button[aria-controls^="support-faq-"]'); assert.equal(await questions.count(),17);
   for(let i=0;i<17;i++) {
    const q=questions.nth(i), node=await q.elementHandle();
    await q.focus(); await page.keyboard.press('Space');
    await page.waitForFunction(el=>el.getAttribute('aria-expanded')==='true',node);
    await page.keyboard.press('Enter');
    await page.waitForFunction(el=>el.getAttribute('aria-expanded')==='false',node);
   }
   let sent=0;
   const track=req=>{if(req.method()==='POST'&&new URL(req.url()).pathname==='/api/support/requests')sent++;};page.on('request',track);
   await page.getByRole('button',{name:'Send support request',exact:true}).click();
   assert.equal(sent,0); assert.ok(await page.getByText('This field is required.',{exact:true}).count()>=4);
   await fill(page); await page.getByLabel('Email Address *',{exact:true}).fill('invalid');
   await page.getByRole('button',{name:'Send support request',exact:true}).click(); await page.getByText('Enter a valid email address.',{exact:true}).waitFor(); assert.equal(sent,0);
   await fill(page);
   let mode='network',release;
   const gate=new Promise(resolve=>{release=resolve;});
   const ids=[];
   await page.route('**/api/support/requests',async route=>{
    ids.push(route.request().postDataJSON().submissionId);
    if(mode==='network') return route.abort('connectionfailed');
    if(mode==='server') return route.fulfill({status:503,json:{message:'unavailable'}});
    if(mode==='delay') {await gate;return route.continue();}
    if(mode==='lost') {const saved=await route.fetch();assert.equal(saved.status(),202);return route.abort('connectionfailed');}
    return route.continue();
   });
   const button=page.getByRole('button',{name:'Send support request',exact:true});
   await button.click();await page.getByRole('alert').waitFor();assert.equal(await page.getByLabel('Message / Description *',{exact:true}).inputValue(),'Support fixture: GPS tracking is unavailable.');
   mode='server';await button.click();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('status').count(),0,'No fake success');
   mode='delay'; const before=sent;await button.click();await page.getByRole('button',{name:'Sending…',exact:true}).waitFor();
   await page.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
   await page.waitForTimeout(150);assert.equal(sent,before+1,'Duplicate clicks blocked');release();
   await page.getByRole('status').filter({hasText:'Your support request has been received.'}).waitFor();
   assert.equal(new Set(ids).size,1,'Retries keep one submission reference');
   assert.equal(await page.getByLabel('Message / Description *',{exact:true}).inputValue(),'');
   if(width===1440){
    await fill(page,'Support fixture with lost response.');mode='lost';await button.click();await page.getByRole('alert').waitFor();
    const lostId=ids.at(-1);mode='normal';await button.click();await page.getByRole('status').filter({hasText:'Your support request has been received.'}).waitFor();assert.equal(ids.at(-1),lostId,'Backend-accepted lost response replays the same ticket');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`${output}/${process.env.PLAYWRIGHT_ENGINE||'chromium'}-${width}-form.png`,fullPage:true});
   await page.getByRole('heading',{name:'How Can We Help You?',exact:true}).scrollIntoViewIfNeeded();
   await page.screenshot({path:`${output}/${process.env.PLAYWRIGHT_ENGINE||'chromium'}-${width}-faq.png`});
   await context.close();console.log('PASS '+width+': all 17 accordions, validation, real backend acceptance, failure retention, idempotent retries, duplicate guard and responsive layout');
  }
  const anonymous=await browser.newPage();await anonymous.goto(base+'/admin');await anonymous.waitForURL('**/login*');await anonymous.close();
 } finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

