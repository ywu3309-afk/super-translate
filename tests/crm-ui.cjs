'use strict';
const {_electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {prepareTestLogin,loginToWorkbench}=require('./login-helper.cjs');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'super-translate-crm-ui-'));
  const login=await prepareTestLogin(profile);
  const env={...process.env,ST_TEST_PROFILE:profile,ST_TEST_FIXTURE:'1',ST_CLOUD_BASE:login.cloudBase};delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'src','desktop.js')],env});
  const checks=[];const ok=(name,value)=>{assert.ok(value,name);checks.push(name);};
  try{
    const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
    await loginToWorkbench(page,login);
    await page.waitForFunction(()=>document.body.classList.contains('live-mode'));
    let wa=null;for(let i=0;i<40&&!wa;i++){wa=app.windows().find(candidate=>candidate.url().includes('wa-fixture.html'));if(!wa)await page.waitForTimeout(100);}
    assert.ok(wa,'WhatsApp fixture WebContentsView was not created');await wa.waitForSelector('#composer');

    const rawPhone='+33 6 00 00 01 01',phone='33600000101';
    await page.waitForFunction(async value=>!!(await window.TrafficCRM.getCustomer(value)),phone,{timeout:8000});
    const first=await page.evaluate(value=>window.TrafficCRM.getCustomer(value),phone);
    ok('Snapshot phone automatically creates IndexedDB customer',first.phone===phone&&first.country==='法国'&&first.flag==='🇫🇷'&&first.status==='following');
    ok('Contact status card shows normalized phone',await page.locator('#crm-contact-card').textContent().then(text=>text.includes('+'+phone)));
    ok('Following button starts active',await page.locator('#crm-contact-card [data-crm-status="following"]').getAttribute('aria-pressed')==='true');

    // Exercise a second chat snapshot carrying exactly the same phone.  The
    // primary key is the normalized phone, so this must not rewrite first seen.
    await page.waitForTimeout(30);
    await wa.evaluate(value=>window.setFixtureChat(value,'false_33600000999@c.us_repeat'),rawPhone);
    await page.waitForTimeout(2200);
    const repeated=await page.evaluate(value=>window.TrafficCRM.getCustomer(value),phone);
    ok('Repeated snapshot keeps original firstContactDate',repeated.firstContactDate===first.firstContactDate);
    ok('Repeated snapshot keeps original firstContactTimestamp',repeated.firstContactTimestamp===first.firstContactTimestamp);

    await page.locator('#crm-contact-card [data-crm-status="deal"]').click();
    await page.waitForFunction(async value=>(await window.TrafficCRM.getCustomer(value))?.status==='deal',phone);
    const deal=await page.evaluate(value=>window.TrafficCRM.getCustomer(value),phone);
    ok('Deal button persists IndexedDB status',deal.status==='deal'&&Number.isFinite(deal.dealTimestamp));
    ok('Deal button reflects active state',await page.locator('#crm-contact-card [data-crm-status="deal"]').getAttribute('aria-pressed')==='true');

    await page.locator('[data-tool="fans"]').click();
    await page.waitForFunction(()=>document.querySelector('#crm-new-count')?.textContent==='1'&&document.querySelector('#crm-deal-count')?.textContent==='1');
    ok('Selected-day cohort metrics render',await page.locator('#crm-conversion').textContent()==='100%');
    ok('Country distribution renders France and 100 percent',(await page.locator('#crm-country-list').textContent()).includes('🇫🇷 法国')&&(await page.locator('#crm-country-list').textContent()).includes('100%'));
    ok('Customer list renders persisted deal status',(await page.locator('#crm-customer-list').textContent()).includes('已成交'));

    const previousDate=await page.evaluate(()=>window.TrafficCRM.localDate(Date.now()-86400000));
    await page.locator('#crm-report-date').fill(previousDate);await page.locator('#crm-report-date').dispatchEvent('change');
    await page.waitForFunction(()=>document.querySelector('#crm-new-count')?.textContent==='0');
    ok('Date selector switches to an empty historical report',await page.locator('#crm-deal-count').textContent()==='0'&&await page.locator('#crm-conversion').textContent()==='0%');

    await page.locator('#crm-report-date').fill(first.firstContactDate);await page.locator('#crm-report-date').dispatchEvent('change');
    await page.waitForFunction(()=>document.querySelector('#crm-new-count')?.textContent==='1');
    const csv=await page.evaluate(date=>window.TrafficCRM.buildCsv(date),first.firstContactDate);
    ok('CSV contains BOM, columns, phone, country and deal state',csv.startsWith('\uFEFF号码,国家,进粉时间,成交状态')&&csv.includes(phone)&&csv.includes('法国')&&csv.includes('已成交'));
    ok('CSV export action is present and enabled',await page.locator('#crm-export-csv').isEnabled());

    const currentWa=fs.readFileSync(path.join(root,'src','wa-preload.js'),'utf8');
    // Assert the two actual contracts that matter to this integration instead
    // of pinning the complete send implementation to the obsolete v0.7.15
    // Chinese-only source gate.
    ok('WhatsApp CRM identity/profile decorators remain wired',/ipcRenderer\.on\('wa:identities'/.test(currentWa)&&/function decorateCountryRows\(\)/.test(currentWa)&&/command\.op==='profiles'/.test(currentWa));
    ok('WhatsApp send still revalidates current chat and exact draft',/liveComposer\(chatKey,original\)/.test(currentWa)&&/chat\(\)\.key!==chatKey/.test(currentWa)&&/composerTextMatches\(cleanDraft\(inputEl\),translated\)/.test(currentWa));
    ok('WhatsApp send translates every non-empty source language',/composerState=\{chat:chatKey,original:text,translated:'',status:'waiting'/.test(currentWa)&&!/草稿已经不是中文/.test(currentWa));
    console.log(JSON.stringify({ok:true,passed:checks.length,checks,first,deal},null,2));
  }finally{
    await app.close().catch(()=>{});await login.closeCloud().catch(()=>{});try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
  }
})().catch(error=>{console.error(error);process.exit(1);});
