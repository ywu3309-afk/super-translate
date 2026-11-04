'use strict';

// Contact-identity drift coverage for the browser extension. Every DOM value
// below is synthetic, the page is about:blank, and chrome.runtime is an
// in-page fixture. No extension profile, cloud account, or WhatsApp message is
// read or changed by this test.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'D:\\SuperTranslate\\BrowserTesting';
const composerSource=fs.readFileSync(path.resolve(__dirname,'../browser-extension/auto-compose.js'),'utf8');
const checks=[];
function check(name,value){assert.ok(value,name);checks.push(name);}

function fixture({pane='',header='<span title="Synthetic customer">Synthetic customer</span>',messages=''}){
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    #main{position:fixed;inset:0 0 0 260px}#pane-side{position:fixed;inset:0 auto 0 0;width:260px}
    header{height:64px}footer{position:fixed;left:260px;right:0;bottom:0;height:64px}
    [contenteditable]{display:block;width:420px;height:38px}
  </style></head><body>
    <aside id="pane-side">${pane}</aside>
    <main id="main"><header>${header}</header><section>${messages}</section>
      <footer><div contenteditable="true" role="textbox" data-tab="10"></div></footer>
    </main>
  </body></html>`;
}

async function observedChatKey(html){
  // Top-level node:test cases may run concurrently. Give each case an isolated
  // browser so one case cannot close another case's page or inherit its timer.
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  try{
    await page.setContent(html);
    await page.evaluate(()=>{
      globalThis.__stMessages=[];
      if(typeof crypto.randomUUID!=='function')Object.defineProperty(crypto,'randomUUID',{value:()=>`synthetic-${Date.now()}-draft`,configurable:true});
      const runtime={
        async sendMessage(message){
          globalThis.__stMessages.push(structuredClone(message));
          if(message.type==='STATUS')return {ok:true,settings:{
            enabled:false,auto:false,autoSend:false,livePreview:true,
            replyMode:'follow',outgoing:'en',accountRevision:'synthetic-account'
          }};
          if(message.type==='CHAT_PREFS')return {ok:true,prefs:{source:'auto',reply:'default',detected:''}};
          throw new Error(`Unexpected fixture message: ${message.type}`);
        }
      };
      const chromeObject=globalThis.chrome||{};
      Object.defineProperty(chromeObject,'runtime',{value:runtime,writable:true,configurable:true});
      Object.defineProperty(globalThis,'chrome',{value:chromeObject,writable:true,configurable:true});
    });
    await page.evaluate(source=>(0,eval)(source),composerSource);
    await page.waitForFunction(()=>globalThis.__stMessages.some(message=>message.type==='CHAT_PREFS'),null,{timeout:3000});
    return await page.evaluate(()=>globalThis.__stMessages.find(message=>message.type==='CHAT_PREFS').chatKey);
  }finally{
    await page.close();
    await browser.close();
  }
}

test('accepts a bare JID when WhatsApp omits true/false and message suffixes',async()=>{
  const key=await observedChatKey(fixture({
    messages:'<article class="message-in" data-id="491570001111@c.us"></article>'
  }));
  assert.equal(key,'491570001111@c.us');
  check('accepts a bare JID',true);
});

test('prefers the currently selected conversation-row JID',async()=>{
  const key=await observedChatKey(fixture({
    pane:'<div role="row"><div aria-selected="true"><div data-id="false_346100002222@c.us_ROW1"></div></div></div>',
    messages:'<article class="message-in" data-id="false_491570001111@c.us_OLD1"></article>'
  }));
  assert.equal(key,'346100002222@c.us');
  check('selected row JID has priority',true);
});

test('uses the international header phone when no serialized JID exists',async()=>{
  const key=await observedChatKey(fixture({
    header:'<span title="+1 (904) 624-8817">+1 (904) 624-8817</span>'
  }));
  assert.equal(key,'phone:+19046248817');
  check('header phone fallback',true);
});

test('does not mistake an outgoing self JID for the open customer',async()=>{
  const key=await observedChatKey(fixture({
    header:'<span title="+1 (904) 624-8817">+1 (904) 624-8817</span>',
    messages:'<article class="message-out" data-id="true_15550000000@c.us_OUT1"></article>'
  }));
  assert.equal(key,'phone:+19046248817');
  check('outgoing self JID rejected',true);
});

test('does not use a phone number from the selected row message preview',async()=>{
  const key=await observedChatKey(fixture({
    pane:'<div role="row" aria-selected="true"><span data-testid="cell-frame-title" title="Synthetic customer">Synthetic customer</span><small>Please contact +44 7700 900123 after delivery</small></div>',
    header:'<span title="Synthetic customer">Synthetic customer</span>'
  }));
  assert.notEqual(key,'phone:+447700900123');
  check('message-preview phone rejected',true);
});
test('phone-only current header reaches native compose translation',async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  try{
    await page.setContent(fixture({
      header:'<span title="+1 (904) 624-8817">+1 (904) 624-8817</span>',
      messages:'<article class="message-in" data-pre-plain-text="fixture"><span class="selectable-text">Thank you for your help with this order and the shipping information.</span></article>'
    }));
    await page.evaluate(()=>{
      globalThis.__stMessages=[];
      if(typeof crypto.randomUUID!=='function')Object.defineProperty(crypto,'randomUUID',{value:()=>`synthetic-${Date.now()}-draft`,configurable:true});
      const runtime={async sendMessage(message){
        globalThis.__stMessages.push(structuredClone(message));
        if(message.type==='STATUS')return{ok:true,settings:{enabled:true,auto:false,autoSend:true,livePreview:true,replyMode:'follow',outgoing:'en',accountRevision:'synthetic-account'}};
        if(message.type==='CHAT_PREFS')return{ok:true,prefs:{source:'en',reply:'default',detected:''}};
        if(message.type==='DETECT_LANGUAGE')return{ok:true,prefs:{source:'en',reply:'default',detected:'en'}};
        if(message.type==='TRANSLATE')return{ok:true,translation:'Hello',sendTicket:'synthetic-ticket',notes:[],cautions:[]};
        throw new Error(`Unexpected fixture message: ${message.type}`);
      }};
      const chromeObject=globalThis.chrome||{};
      Object.defineProperty(chromeObject,'runtime',{value:runtime,writable:true,configurable:true});
      Object.defineProperty(globalThis,'chrome',{value:chromeObject,writable:true,configurable:true});
    });
    await page.evaluate(source=>(0,eval)(source),composerSource);
    await page.waitForFunction(()=>globalThis.__stMessages.some(message=>message.type==='DETECT_LANGUAGE'),null,{timeout:3000});
    await page.waitForTimeout(150);
    await page.locator('[contenteditable]').evaluate((editor,text)=>{
      editor.focus();editor.textContent=text;editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));
    },'你好');
    await page.waitForFunction(()=>globalThis.__stMessages.some(message=>message.type==='TRANSLATE'&&message.purpose==='compose'),null,{timeout:3000});
    const request=await page.evaluate(()=>globalThis.__stMessages.find(message=>message.type==='TRANSLATE'&&message.purpose==='compose'));
    assert.equal(request.text,'你好');
    assert.equal(request.target,'en');
    check('phone-only native compose reaches translate',true);
  }finally{
    await page.close();
    await browser.close();
  }
});

process.on('beforeExit',()=>{
  const out=path.resolve(__dirname,'../outputs/browser-extension/contact-drift-verification.json');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify({ok:checks.length===6,at:new Date().toISOString(),scope:'Synthetic about:blank WhatsApp DOM drift fixtures. No real profile, account, cloud translation, or message send.',checks},null,2));
});
