// Real SQL/API fixture test. Explicit database-name guard prevents live WWMS writes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.WWMS_WEB_URL.replace(/\/$/,'');
const trip=process.env.WWMS_SHORE_TRIP_ID;
const database=process.env.WWMS_FIXTURE_DATABASE;
const ids=JSON.parse(process.env.WWMS_FIXTURE_PASSENGERS);
const output='.runlogs/shore-passenger-summary';
if(!/^WWMS_ComplaintTests_[a-f0-9]{32}$/i.test(database)||new URL(base).hostname!=='127.0.0.1')throw Error('Only disposable local fixture databases are permitted');
if(!/^[a-f0-9-]{36}$/i.test(trip)||Object.values(ids).some(id=>!/^[a-f0-9-]{36}$/i.test(id)))throw Error('Unexpected fixture IDs');
function sql(text){execFileSync('sqlcmd',['-S',process.env.WWMS_FIXTURE_SERVER,'-E','-C','-b','-d',database,'-Q','SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF; SET XACT_ABORT ON; '+text],{encoding:'utf8'});}
async function expectRow(page,label,values){
 const row=page.getByRole('region',{name:'Passenger summary table',exact:true}).getByRole('row').filter({has:page.getByRole('rowheader',{name:label,exact:true})});
 await page.waitForFunction(({label,values})=>{
  const table=document.querySelector('[aria-label="Passenger summary table"] table');
  const row=[...(table?.querySelectorAll('tbody tr')||[])].find(r=>r.querySelector('th')?.textContent===label);
  return row&&JSON.stringify([...row.querySelectorAll('td')].map(c=>c.textContent))===JSON.stringify(values.map(String));
 },{label,values});
 assert.deepEqual(await row.getByRole('cell').allTextContents(),values.map(String));
}
function personRow(page,name){return page.getByRole('region',{name:'Passenger manifest table',exact:true}).getByRole('row').filter({has:page.getByRole('rowheader',{name:new RegExp(name+'$')})});}
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const engine=process.env.PLAYWRIGHT_ENGINE==='webkit'?webkit:chromium;
 const browser=await engine.launch(engine===chromium?{channel:'msedge',headless:true}:{headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const response=await context.request.post(base+'/api/auth/login',{data:{email:'shorecrew@complaint-test.example',password:'BrowserTest#2026!Only'}});
  assert.equal(response.status(),200);const auth=await response.json();
  await context.addInitScript(token=>{if(!sessionStorage.getItem('whale-watching-refresh-token'))sessionStorage.setItem('whale-watching-refresh-token',token);},auth.refreshToken);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const writes=[];page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method())&&/\/api\/(shore|operations)\//.test(new URL(r.url()).pathname))writes.push(r.url());});
  await page.route('**/api/operations/trips/*/passengers',route=>route.fulfill({status:503,json:{message:'Fixture initial load unavailable.'}}));
  await page.goto(base+'/shore/trips/'+trip);
  await page.getByRole('heading',{name:'Passenger Summary',exact:true}).waitFor();
  assert.equal(await page.getByText('Passenger summary for everyone registered on this trip, including passengers not yet checked in.',{exact:true}).count(),0);
  await page.getByRole('alert').filter({hasText:'Fixture initial load unavailable.'}).waitFor();
  assert.ok((await page.getByRole('region',{name:'Passenger summary table',exact:true}).getByRole('cell').allTextContents()).every(text=>text==='—'),'Unavailable data does not appear as a zero-passenger trip');
  await page.unroute('**/api/operations/trips/*/passengers');
  await page.getByRole('button',{name:'Refresh attendance',exact:true}).click();
  await expectRow(page,'Grand Total',[0,0,0,0]);
  assert.equal(await page.getByRole('region',{name:'Passenger manifest table',exact:true}).getByRole('rowheader').count(),12,'Registered manifest is unchanged while onboard total is zero');
  const onboard=['Local Adult','Local Child','Local Small','Foreign Adult','Foreign Child','Foreign Small','Local Legacy','Special Needs','Missing Classification'];
  sql(`INSERT TripPassengerAttendances(Id,TripPassengerId,Status,CheckedAtUtc,UpdatedAtUtc) SELECT NEWID(),Id,1,SYSUTCDATETIME(),SYSUTCDATETIME() FROM TripPassengers WHERE TripId='${trip}' AND PassengerId IN (${onboard.map(name=>"'"+ids[name]+"'").join(',')}); INSERT TripPassengerAttendances(Id,TripPassengerId,Status,CheckedAtUtc,UpdatedAtUtc) SELECT NEWID(),Id,2,NULL,SYSUTCDATETIME() FROM TripPassengers WHERE TripId='${trip}' AND PassengerId='${ids['Invalid Country']}';`);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expectRow(page,'Local',[3,1,1,0,5]);await expectRow(page,'Foreign',[1,1,1,0,3]);
  await expectRow(page,'Not recorded',[0,0,0,1,1]);await expectRow(page,'Grand Total',[4,2,2,1,9]);
  assert.equal(await page.evaluate(()=>{
   const summary=document.getElementById('shore-departure-summary-title').closest('section');
   const departure=[...document.querySelectorAll('h2')].find(h=>h.textContent==='Trip departure').closest('section');
   return summary.parentElement.nextElementSibling===departure;
  }),true,'Summary is immediately above departure');
  assert.deepEqual(await page.locator('main h2').allTextContents(),['Passenger Attendance','Passenger Check-In','Passenger Manifest','Crew (0)','Passenger Summary','Trip departure'],'Other sections keep their order');
  assert.ok(await page.getByRole('heading',{name:'Passenger Summary',exact:true}).evaluate(el=>getComputedStyle(el.closest('section')).backgroundImage.includes('gradient')),'Only summary uses the Deep Ocean surface');
  await page.waitForFunction(()=>[...document.querySelectorAll('[aria-label="Passenger manifest table"] img')].every(img=>img.complete&&img.naturalWidth>0));
  for(const [name,country,category,age] of [['Local Adult','Sri Lanka','Local','Adult'],['Local Child','Sri Lanka','Local','Child'],['Local Small','Sri Lanka','Local','Under 6'],['Foreign Adult','United Kingdom','Foreign','Adult'],['Foreign Child','United States','Foreign','Child'],['Foreign Small','Japan','Foreign','Under 6'],['Local Legacy','Sri Lanka','Local','Adult'],['Country Only','Germany','Foreign','Adult']]){
   const row=personRow(page,name);await row.getByText(country,{exact:true}).waitFor();
   assert.equal(await row.getByText(category,{exact:true}).count(),1);assert.equal(await row.getByText(age,{exact:true}).count(),1);
   const flag=row.locator('img');assert.equal(await flag.getAttribute('aria-label'),country+' flag');
   assert.ok((await flag.getAttribute('src')).startsWith('/shore-flags/'),'Flag loads from this website');
   const nameCell=row.getByRole('rowheader');assert.ok(await nameCell.locator('img + span').count(),'Flag precedes name');
  }
  for(const name of ['Foreign Missing Country','Invalid Country','Missing Classification']){
   const row=personRow(page,name);assert.equal(await row.locator('img').count(),0);assert.ok(await row.getByText('Not recorded',{exact:true}).count()>=1);
  }
  await personRow(page,'Special Needs').getByText('Special needs registration',{exact:true}).waitFor();
  const raw=await context.request.get(base+'/api/operations/trips/'+trip+'/passengers',{headers:{Authorization:'Bearer '+auth.accessToken}});
  assert.equal((await raw.json()).length,12);
  for(const width of [320,375,768,1024,1440,1600]){
   await page.setViewportSize({width,height:width<768?844:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Page fits '+width);
   const region=page.getByRole('region',{name:'Passenger manifest table',exact:true});
   if(width<768)assert.ok(await region.evaluate(el=>el.scrollWidth>el.clientWidth),'Manifest scrolls within the mobile card');
   await page.screenshot({path:output+'/'+(process.env.PLAYWRIGHT_ENGINE||'chromium')+'-'+width+'.png',fullPage:true});
  }
  sql(`UPDATE a SET Status=2,CheckedAtUtc=NULL FROM TripPassengerAttendances a JOIN TripPassengers p ON p.Id=a.TripPassengerId WHERE p.TripId='${trip}' AND p.PassengerId='${ids['Local Adult']}';`);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expectRow(page,'Grand Total',[3,2,2,1,8]);
  sql(`UPDATE a SET Status=0,CheckedAtUtc=SYSUTCDATETIME() FROM TripPassengerAttendances a JOIN TripPassengers p ON p.Id=a.TripPassengerId WHERE p.TripId='${trip}' AND p.PassengerId='${ids['Local Adult']}';`);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expectRow(page,'Grand Total',[3,2,2,1,8]);
  sql(`UPDATE a SET Status=1,CheckedAtUtc=SYSUTCDATETIME() FROM TripPassengerAttendances a JOIN TripPassengers p ON p.Id=a.TripPassengerId WHERE p.TripId='${trip}' AND p.PassengerId='${ids['Local Adult']}';`);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expectRow(page,'Grand Total',[4,2,2,1,9]);
  console.log('PASS verified Present-only totals, absent/unchecked exclusions, placement, unchanged manifest, Deep Ocean styling and six viewport layouts');
  // Edit the existing fixture in place; no passenger is duplicated. Parent operations
  // polling must update demographics even though the overall trip count is unchanged.
  sql(`UPDATE PassengerProfiles SET PassengerType='foreign',CountryCode='FR',AgeCategory='small',Name='Updated Local Adult' WHERE Id='${ids['Local Adult']}';`);
  await expectRow(page,'Local',[2,1,1,0,4]);await expectRow(page,'Foreign',[1,1,2,0,4]);
  await personRow(page,'Updated Local Adult').getByText('France',{exact:true}).waitFor();
  await personRow(page,'Updated Local Adult').getByText('Under 6',{exact:true}).waitFor();
  assert.equal(await personRow(page,'Updated Local Adult').locator('img').getAttribute('aria-label'),'France flag');
  console.log('PASS automatic polling refresh after nationality, age and name modification');
  sql(`BEGIN TRAN; INSERT PassengerProfiles(Id,Name,IdentificationNumber,NormalizedIdentificationNumber,PhoneNumber,NormalizedPhoneNumber,PassengerType,CountryCode,Gender,AgeCategory,SelfCareConfirmed,CreatedAtUtc) VALUES('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee','Added Passenger','ADDED-FIXTURE','ADDED-FIXTURE','','','local','LK','','child',0,SYSUTCDATETIME()); INSERT TripPassengers(Id,TripId,PassengerId,PrimaryPassengerId,RegisteredAtUtc) VALUES(NEWID(),'${trip}','aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee','aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',SYSUTCDATETIME()); UPDATE Trips SET PassengerCount=13 WHERE Id='${trip}'; COMMIT;`);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await personRow(page,'Added Passenger').waitFor();await expectRow(page,'Grand Total',[3,2,3,1,9]);
  sql(`INSERT TripPassengerAttendances(Id,TripPassengerId,Status,CheckedAtUtc,UpdatedAtUtc) SELECT NEWID(),Id,1,SYSUTCDATETIME(),SYSUTCDATETIME() FROM TripPassengers WHERE TripId='${trip}' AND PassengerId='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';`);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expectRow(page,'Grand Total',[3,3,3,1,10]);
  sql(`DELETE FROM TripPassengers WHERE TripId='${trip}' AND PassengerId='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'; UPDATE Trips SET PassengerCount=12 WHERE Id='${trip}';`);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expectRow(page,'Grand Total',[3,2,3,1,9]);
  assert.equal(await personRow(page,'Added Passenger').count(),0);
  // Test failures and a two-endpoint membership race without writing production data.
  await page.route('**/api/operations/trips/*/passengers',route=>route.fulfill({status:503,json:{message:'Fixture passenger list unavailable.'}}));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('alert').filter({hasText:'Fixture passenger list unavailable.'}).waitFor();
  await expectRow(page,'Grand Total',[3,2,3,1,9]);
  await page.unroute('**/api/operations/trips/*/passengers');
  await page.getByRole('button',{name:'Refresh attendance',exact:true}).click();await expectRow(page,'Grand Total',[3,2,3,1,9]);
  let rosterReads=0;
  await page.route('**/api/operations/trips/*/passengers',route=>++rosterReads===1 ? route.fulfill({json:[]}) : route.continue());
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  for(let i=0;i<100&&rosterReads<2;i++)await page.waitForTimeout(50);
  assert.ok(rosterReads>=2,'A concurrent membership mismatch retries');
  await expectRow(page,'Grand Total',[3,2,3,1,9]);
  await page.unroute('**/api/operations/trips/*/passengers');
  // The actual empty-trip API response should produce all zeroes, with no guessed rows.
  sql(`DELETE FROM TripPassengers WHERE TripId='${trip}'; UPDATE Trips SET PassengerCount=0 WHERE Id='${trip}';`);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expectRow(page,'Grand Total',[0,0,0,0]);
  await expectRow(page,'Local',[0,0,0,0]);await expectRow(page,'Foreign',[0,0,0,0]);
  await page.getByText('No passengers registered for this trip.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Complete Passenger Verification',exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:'Start Trip',exact:true}).isDisabled(),true);
  assert.deepEqual(writes,[],'Presentation never writes attendance, bookings, approval or departure');
  assert.deepEqual(errors,[]);
  // Another portal keeps its own presentation; the Shore-specific summary is absent.
  const other=await browser.newContext();const owner=await other.request.post(base+'/api/auth/login',{data:{email:'boatowner@complaint-test.example',password:'BrowserTest#2026!Only'}});
  const ownerAuth=await owner.json();await other.addInitScript(token=>{if(!sessionStorage.getItem('whale-watching-refresh-token'))sessionStorage.setItem('whale-watching-refresh-token',token);},ownerAuth.refreshToken);
  const ownerPage=await other.newPage();await ownerPage.goto(base+'/owner');await ownerPage.getByRole('link',{name:'Account settings',exact:true}).waitFor();
  assert.equal(await ownerPage.getByRole('region',{name:'Passenger summary table',exact:true}).count(),0);
  await other.close();await context.close();console.log('PASS add/remove, error retention/recovery, empty manifest, unchanged workflow controls and portal isolation');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
