'use strict';
const {_electron}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
  const app=await _electron.launch({executablePath:require('electron'),args:['--no-sandbox',path.join(__dirname,'platform-fixture-main.cjs')],env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}});
  try{
    const page=await app.firstWindow();
    await page.waitForSelector('.st-platform-translation');
    assert.equal(await page.locator('.st-platform-translation-text').textContent(),'来自 Telegram 的中文译文','incoming message is translated in a scoped card');
    assert.equal(await page.evaluate(()=>window.__platformEvents?.['response-init']?.ok),true,'init command receives a response');
    await page.waitForFunction(()=>window.__platformEvents?.['response-config']?.ok===true);
    await page.evaluate(()=>{
      const input=document.querySelector('.input-message-input');input.textContent='你好，测试发送';input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'你好，测试发送'}));input.focus();
    });
    await page.waitForFunction(()=>window.__platformEvents?.preview?.status==='ready');
    await page.locator('.input-message-input').press('Enter');
    await page.waitForFunction(()=>document.querySelector('#sent')?.textContent==='Translated Telegram reply');
    assert.equal(await page.locator('.input-message-input').textContent(),'','translated text was injected and sent');
    console.log(JSON.stringify({ok:true,checks:5}));
  }finally{await app.close();}
})().catch(error=>{console.error(error?.stack||error);process.exit(1);});
