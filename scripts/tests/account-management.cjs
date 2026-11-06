// Runs only against the disposable database/API started by AccountDeletionTests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { HubConnectionBuilder, LogLevel, HubConnectionState } = require('../../apps/web/node_modules/@microsoft/signalr');
const base = process.env.WWMS_WEB_URL.replace(/\/$/, '');
const output = '.runlogs/account-management/browser';
const description = 'Delete your account permanently from the Whale-Watching & Boat Monitoring System.';
const portals = [['Admin','/admin'],['BoatOwner','/owner/settings'],['BoatCrew','/crew/settings'],['OPS','/ops'],['ShoreCrew','/shore/settings'],['Supervisor','/supervisor'],['SLTDA','/sltda'],['Wildlife','/wildlife'],['ShoreWildlife','/shore-wildlife'],['HarbourOfficer','/harbour-officer'],['Passenger','/passenger']];
const password = 'BrowserTest#2026!Only';
async function login(context, role) {
  const response = await context.request.post(base+'/api/auth/login', {data:{email:role.toLowerCase()+'@complaint-test.example',password}});
  assert.equal(response.status(),200,role+' real login'); return response.json();
}
async function session(context, auth) {
  await context.addInitScript(token => { if(!sessionStorage.getItem('whale-watching-refresh-token')) sessionStorage.setItem('whale-watching-refresh-token',token); },auth.refreshToken);
}
(async () => {
  fs.mkdirSync(output,{recursive:true});
  const engine = process.env.PLAYWRIGHT_ENGINE === 'webkit' ? webkit : chromium;
  const browser = await engine.launch(engine === chromium ? {channel:'msedge',headless:true} : {headless:true});
  const hubs = [];
  try {
    // Verify both view and edit labels with the existing address-to-bio API mapping.
    const admin = await browser.newContext(); await session(admin,await login(admin,'Admin'));
    const profile = await admin.newPage();
    for (const [kind,id,edit] of [['owners',process.env.WWMS_OWNER_ID,'Edit owner'],['crew',process.env.WWMS_CREW_ID,'Edit crew member']]) {
      await profile.goto(`${base}/admin/${kind}/${id}`);
      await profile.getByText('Bio',{exact:true}).waitFor();
      await profile.getByText('Existing profile biography',{exact:true}).waitFor();
      assert.equal(await profile.getByText('Address',{exact:true}).count(),0);
      await profile.getByRole('button',{name:edit,exact:true}).click();
      assert.equal(await profile.getByLabel('Bio',{exact:true}).inputValue(),'Existing profile biography');
      await profile.getByLabel('Bio',{exact:true}).fill('Updated '+kind+' biography');
      await profile.getByRole('button',{name:'Save changes',exact:true}).click();
      await profile.getByText('Updated '+kind+' biography',{exact:true}).waitFor();
      await profile.reload(); await profile.getByText('Updated '+kind+' biography',{exact:true}).waitFor();
    }
    await admin.close(); console.log('PASS Admin owner/crew Bio view, edit and persistence');

    // Keep another user's realtime connection open to verify revocation is scoped.
    const controlContext = await browser.newContext(); const control = await login(controlContext,'OPS');
    const controlHub = new HubConnectionBuilder().withUrl(base+'/hubs/operations',{accessTokenFactory:()=>control.accessToken}).configureLogging(LogLevel.None).build();
    hubs.push(controlHub);
    await controlHub.start();
    for (const [index,[role,path]] of portals.entries()) {
      const context = await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
      const auth = await login(context,role); await session(context,auth);
      const page = await context.newPage();
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+path);
      if(!['BoatOwner','BoatCrew'].includes(role)) {
        await page.getByRole('link',{name:'Account settings',exact:true}).click();
        await page.getByRole('link',{name:/Back to .*Portal/}).waitFor();
      }
      await page.getByRole('button',{name:/Delete My Account/}).click();
      const dialog = page.getByRole('dialog',{name:'Delete My Account',exact:true}); await dialog.waitFor();
      assert.equal(await dialog.getByText(description,{exact:true}).count(),1);
      const input = dialog.getByPlaceholder('Type confirm to continue');
      const submit = dialog.getByRole('button',{name:'Permanently delete account',exact:true});
      let sent=0;
      page.on('request',req=>{if(req.method()==='DELETE'&&new URL(req.url()).pathname==='/api/auth/account')sent++;});
      for(const width of index<3 ? [1440,375] : [index%2 ? 375 : 1440]) {
        await page.setViewportSize({width,height:width<768?844:960});
        for(const value of ['', 'Confirm','CONFIRM','confirm ',' confirm','confirm\n']) {
          // Use a trailing character instead of a newline for input[type=text], which browsers normalize.
          await input.fill(value.includes('\n') ? 'confirm x' : value);
          assert.equal(await submit.isDisabled(),true,role+' rejects '+JSON.stringify(value));
          await dialog.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
          assert.equal(sent,0);
        }
        await input.fill('confirm'); assert.equal(await submit.isEnabled(),true);
        const box = await dialog.boundingBox(); assert.ok(box.x>=0 && box.x+box.width<=width+1,role+' mobile dialog bounds');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        if(index<3) await page.screenshot({path:`${output}/${process.env.PLAYWRIGHT_ENGINE||'chromium'}-${role}-${width}.png`});
      }
      if(index===0) {
        await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
        await page.getByRole('button',{name:/Delete My Account/}).click();
        await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(),0);
        await page.getByRole('button',{name:/Delete My Account/}).click(); await input.fill('confirm');
        let mode='network'; let release; const gate=new Promise(resolve=>{release=resolve;});
        await page.route('**/api/auth/account',async route=>{
          if(mode==='network')return route.abort('connectionfailed');
          if(mode==='server')return route.fulfill({status:503,json:{message:'Account deletion is temporarily unavailable.'}});
          if(mode==='delay')await gate;
          return route.continue();
        });
        await submit.click(); await dialog.getByRole('alert').waitFor(); assert.equal(await input.inputValue(),'confirm');
        mode='server'; await submit.click(); await dialog.getByText('Account deletion is temporarily unavailable.',{exact:true}).waitFor();
        assert.equal(new URL(page.url()).pathname,'/account','Failure does not claim success or log out');
        mode='delay'; const before=sent; await submit.click();
        await dialog.getByRole('button',{name:'Deleting account...',exact:true}).waitFor();
        await dialog.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
        await page.waitForTimeout(100); assert.equal(sent,before+1,'One in-flight request'); release();
      } else {
        await submit.click();
      }
      await page.waitForURL('**/login');
      await page.getByRole('status').filter({hasText:'Your account has been permanently deleted.'}).waitFor();
      assert.equal(await page.evaluate(()=>sessionStorage.getItem('whale-watching-refresh-token')),null);
      assert.equal((await context.request.delete(base+'/api/auth/account',{headers:{Authorization:'Bearer '+auth.accessToken},data:{confirmation:'confirm'}})).status(),401);
      assert.equal((await context.request.post(base+'/api/auth/login',{data:{email:role.toLowerCase()+'@complaint-test.example',password}})).status(),401);
      await page.goto(base+'/account'); await page.waitForURL('**/login');
      assert.deepEqual(errors,[]);
      await context.close(); console.log('PASS '+role+': exact confirmation, responsive dialog, real deletion and invalidated sessions');
      if(role==='BoatCrew')assert.equal(controlHub.state,HubConnectionState.Connected,'Other accounts stay connected');
      if(role==='OPS') {
        for(let i=0;i<50&&controlHub.state!==HubConnectionState.Disconnected;i++)await new Promise(resolve=>setTimeout(resolve,100));
        assert.equal(controlHub.state,HubConnectionState.Disconnected,'Already open realtime session terminated');
        console.log('PASS scoped realtime session revocation');
      }
    }
    await controlHub.stop(); await controlContext.close();
  } finally { await Promise.allSettled(hubs.map(hub=>hub.stop())); await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
