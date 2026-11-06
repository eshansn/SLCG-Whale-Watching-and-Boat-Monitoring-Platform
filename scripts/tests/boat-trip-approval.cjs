// Used only by the isolated SQL/API test harness. No existing WWMS credentials/data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.WWMS_WEB_URL.replace(/\/$/,'');
const fixture=JSON.parse(process.env.WWMS_APPROVAL_FIXTURES);
const message='Your boat has not yet been approved by the relevant authorities. You must receive official approval before scheduling trips.';
const departureMessage='This boat does not currently have valid official approval from the relevant authorities. The trip cannot start until approval is granted.';
const output='.runlogs/boat-approval/browser';
async function login(context,role){const r=await context.request.post(base+'/api/auth/login',{data:{email:role.toLowerCase()+'@complaint-test.example',password:'BrowserTest#2026!Only'}});assert.equal(r.status(),200);return r.json();}
async function init(context,auth){await context.addInitScript(token=>{if(!sessionStorage.getItem('whale-watching-refresh-token'))sessionStorage.setItem('whale-watching-refresh-token',token);},auth.refreshToken);}
function dateInput(days){const now=new Date(Date.now()+days*86400000);return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);}
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const engine=process.env.PLAYWRIGHT_ENGINE==='webkit'?webkit:chromium;
 const browser=await engine.launch(engine===chromium?{channel:'msedge',headless:true}:{headless:true});
 try{
  const owner=await browser.newContext({viewport:{width:1440,height:960}});const ownerAuth=await login(owner,'BoatOwner');await init(owner,ownerAuth);
  const admin=await browser.newContext();const adminAuth=await login(admin,'Admin');
  const authority=async(id,status,auth=adminAuth)=>{const r=await admin.request.patch(base+'/api/operations/boats/'+id+'/approval',{headers:{Authorization:'Bearer '+auth.accessToken},data:{approval:status}});assert.equal(r.status(),204);};
  const page=await owner.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/owner/trips/schedule');
  const select=page.locator('#tripVessel'),submit=page.getByRole('button',{name:'Schedule Trip',exact:true});
  await page.waitForFunction(id=>document.querySelector('#tripVessel')?.value===id,fixture.boatId);
  const options=await select.locator('option').evaluateAll(rows=>rows.map(row=>row.value));
  assert.ok(options.includes(fixture.boatId));assert.ok(!options.includes(fixture.pendingId));assert.ok(!options.includes(fixture.rejectedId));
  const roster=await owner.request.get(base+'/api/operations/boats',{headers:{Authorization:'Bearer '+ownerAuth.accessToken}});const staleBoats=await roster.json();
  await page.locator('input[type=datetime-local]').fill(dateInput(4));
  const accepted=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/operations/trips');
  await submit.click();assert.equal((await accepted).status(),201);
  await page.getByRole('status').filter({hasText:'The trip has been scheduled successfully.'}).waitFor();
  // Freeze an old frontend approval response. The server must still reject the revoked boat.
  await page.route('**/api/operations/boats',route=>route.fulfill({json:staleBoats}));
  await authority(fixture.boatId,'Rejected');
  await page.locator('input[type=datetime-local]').fill(dateInput(6));
  const refused=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/operations/trips');
  await submit.click();assert.equal((await refused).status(),409);
  await page.getByRole('status').filter({hasText:message}).waitFor();
  await page.unroute('**/api/operations/boats');
  await page.waitForFunction(()=>document.querySelector('#tripVessel')?.disabled,{},{timeout:20000});
  assert.equal(await submit.isDisabled(),true);
  const direct=await owner.request.post(base+'/api/operations/trips',{headers:{Authorization:'Bearer '+ownerAuth.accessToken},data:{boatId:fixture.pendingId,scheduledDepartureUtc:new Date(Date.now()+6*86400000).toISOString(),route:'Direct bypass attempt',passengerCount:0,crewUserIds:[],approval:'Approved'}});
  assert.equal(direct.status(),409);assert.equal((await direct.json()).message,message);
  for(const width of [375,1440]){await page.setViewportSize({width,height:width<768?844:960});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:output+'/'+(process.env.PLAYWRIGHT_ENGINE||'chromium')+'-owner-'+width+'.png',fullPage:true});}
  const wildlifeAuth=await login(admin,'Wildlife');
  await authority(fixture.boatId,'Approved',wildlifeAuth);
  await page.waitForFunction(id=>document.querySelector('#tripVessel')?.value===id&&!document.querySelector('#tripVessel').disabled,fixture.boatId);
  assert.equal(await submit.isEnabled(),true,'Either-authority approval restores eligibility');
  console.log('PASS Owner: approved-only options, exact message, real successful scheduling, stale-client/direct API denial, revocation/reapproval and responsive layout');

  const shore=await browser.newContext({viewport:{width:1280,height:960}});const shoreAuth=await login(shore,'ShoreCrew');await init(shore,shoreAuth);
  const shorePage=await shore.newPage();shorePage.on('pageerror',error=>errors.push(error.message));
  await shorePage.goto(base+'/shore/trips/'+fixture.legacyTripId);
  await shorePage.getByRole('alert').filter({hasText:departureMessage}).waitFor();
  assert.equal(await shorePage.getByRole('button',{name:'Start Trip',exact:true}).isDisabled(),true);
  const legacy=await shore.request.post(base+'/api/operations/trips/'+fixture.legacyTripId+'/start',{headers:{Authorization:'Bearer '+shoreAuth.accessToken},data:{confirmRescheduleOverride:true}});assert.equal(legacy.status(),409);
  await shorePage.goto(base+'/shore/trips/'+fixture.tripId);
  await shorePage.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Start Trip'&&!b.disabled));
  await authority(fixture.boatId,'Rejected',wildlifeAuth);
  await shorePage.getByRole('alert').filter({hasText:departureMessage}).waitFor();
  assert.equal(await shorePage.getByRole('button',{name:'Start Trip',exact:true}).isDisabled(),true);
  console.log('PASS Shore: previously scheduled unapproved trips and approval revoked after scheduling cannot depart');

  const ops=await browser.newContext();const opsAuth=await login(ops,'OPS');await init(ops,opsAuth);
  const opsPage=await ops.newPage();opsPage.on('pageerror',error=>errors.push(error.message));
  await opsPage.goto(base+'/ops/trips');await opsPage.getByRole('button',{name:'Start Patrol',exact:true}).click();
  const patrol=opsPage.getByRole('combobox',{name:/Patrol vessel/});
  await patrol.waitFor();const values=await patrol.locator('option').evaluateAll(rows=>rows.map(row=>row.value));
  assert.ok(values.includes(fixture.approvedPatrolId));assert.ok(!values.includes(fixture.pendingPatrolId));
  assert.equal((await ops.request.post(base+'/api/operations/patrol-trips/start',{headers:{Authorization:'Bearer '+opsAuth.accessToken},data:{boatId:fixture.pendingPatrolId}})).status(),409);
  assert.deepEqual(errors,[]);console.log('PASS OPS: unapproved patrol vessels cannot be selected or started through direct API calls');
  await ops.close();await shore.close();await admin.close();await owner.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
