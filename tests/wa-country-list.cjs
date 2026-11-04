'use strict';
const {_electron}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const main=path.join(__dirname,'wa-country-list-main.cjs');
(async()=>{
  const app=await _electron.launch({executablePath:require('electron'),args:['--no-sandbox',main],env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}});
  const checks=[];const ok=(name,value)=>{assert.ok(value,name);checks.push(name);};
  try{
    const page=await app.firstWindow();
    await page.waitForFunction(()=>document.querySelectorAll('.custom-country-tag').length===5,null,{timeout:5000});
    const labels=await page.locator('.custom-country-tag').allTextContents();
    ok('Country tags are injected into WhatsApp left conversation rows',[' (葡萄牙)',' (德国)',' (捷克)',' (埃塞俄比亚)',' (中国大陆)'].every(value=>labels.includes(value)));
    ok('Country tags sit beside the rendered contact names',await page.locator('#pane-side .st-display-name').count()===5);
    ok('Internal contact name is rendered beside the matching left-list phone',await page.locator('#pane-side .st-display-name').filter({hasText:'埃塞测试客户'}).count()===1);
    await page.waitForFunction(()=>document.querySelector('#main header .st-display-name')?.textContent==='内部客户');
    ok('Country attribution is not duplicated in the top conversation header',await page.locator('#main header .custom-country-tag').count()===0&&(await page.locator('#main header .st-display-name').textContent())==='内部客户');
    ok('Business/name rows without an international number stay untouched',await page.locator('#pane-side .st-display-name').filter({hasText:'WhatsApp Business'}).count()===0);
    await page.evaluate(()=>window.addCountryRow());
    await page.waitForFunction(()=>[...document.querySelectorAll('.custom-country-tag')].some(el=>el.textContent===' (阿联酋)'),null,{timeout:3000});
    ok('100ms pane observer decorates virtualized rows after they appear',await page.locator('.custom-country-tag').filter({hasText:'(阿联酋)'}).count()===1);
    await page.waitForTimeout(700);
    ok('Mutation observer does not duplicate existing country tags',await page.locator('.custom-country-tag').count()===6);
    console.log(JSON.stringify({ok:true,passed:checks.length,checks},null,2));
  }finally{await app.close();}
})().catch(error=>{console.error(error?.stack||error);process.exit(1);});
