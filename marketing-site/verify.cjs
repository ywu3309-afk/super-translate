'use strict';
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const reports=[],out=path.resolve(__dirname,'..','outputs','marketing-site');fs.mkdirSync(out,{recursive:true});
  const source=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  assert.doesNotMatch(source,/noindex|nofollow/,'production homepage must be indexable');
  assert.doesNotMatch(source,/官网本地验收稿|实机内测/,'production homepage must not expose draft or Android test status');
  try{
    for(const width of [1440,1024,768,390,360]){
      const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
      const errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4176/'))remote.push(r.url());});
      await page.goto('http://127.0.0.1:4176/',{waitUntil:'networkidle'});
      const metrics=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,h1:document.querySelectorAll('h1').length,brokenAnchors:[...document.querySelectorAll('a[href^="#"]')].filter(a=>a.hash&&a.hash!=='#'&&!document.getElementById(a.hash.slice(1))).map(a=>a.hash),overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)&&!e.classList.contains('skip');}).map(e=>e.className).slice(0,12)}));
      assert.ok(metrics.width<=width,`overflow at ${width}`);assert.deepEqual(metrics.overflow,[],`elements overflow at ${width}`);assert.equal(metrics.h1,1);assert.deepEqual(metrics.brokenAnchors,[]);assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);

      const compact=value=>String(value||'').replace(/\s+/g,'');
      const planCards=page.locator('#plans .price-card[data-plan]');
      assert.equal(await planCards.count(),3,'pricing must contain exactly three identified cards');
      assert.deepEqual(await planCards.evaluateAll(cards=>cards.map(card=>card.dataset.plan)),['text','voice','monthly']);

      const textPlan=compact(await page.locator('#plans .price-card[data-plan="text"]').innerText());
      assert.match(textPlan,/¥100/);assert.match(textPlan,/200万(?:文字翻译)?字符/);
      assert.match(textPlan,/¥200/);assert.match(textPlan,/450万(?:文字翻译)?字符/);
      assert.match(textPlan,/用完为止/,'one-time character packs must say they remain available until used');

      const voicePlan=compact(await page.locator('#plans .price-card[data-plan="voice"]').innerText());
      assert.match(voicePlan,/¥180/);assert.match(voicePlan,/200万文字翻译字符/);assert.match(voicePlan,/语音消息翻译/);
      assert.match(voicePlan,/不另设时长或次数上限/,'advanced voice plan must state its voice allowance boundary');

      const monthlyPlan=compact(await page.locator('#plans .price-card[data-plan="monthly"]').innerText());
      assert.match(monthlyPlan,/¥300/);assert.match(monthlyPlan,/\/月/);assert.match(monthlyPlan,/不限文字翻译字符/);
      assert.match(monthlyPlan,/包含语音/,'monthly plan must explicitly include voice');

      const plansText=compact(await page.locator('#plans').innerText());
      assert.doesNotMatch(plansText,/价格待定|方案待定/);
      assert.match(plansText,/1个主账号[+＋]3个子账号/,'all plans must state the shared account allowance');
      assert.match(plansText,/每个账号同时在线1台设备/,'all plans must state the per-account online-device allowance');

      const android=page.locator('#platforms .platform-card').filter({hasText:'Android App'});assert.equal(await android.count(),1);assert.match(await android.innerText(),/正式发布/);assert.match(await android.innerText(),/v0\.3\.5/);
      const browserExtension=page.locator('#platforms .platform-card').filter({hasText:'Chrome / Edge 扩展'});assert.equal(await browserExtension.count(),1);assert.match(await browserExtension.innerText(),/商店已上架/);assert.match(await browserExtension.innerText(),/网页.*字幕/);
      const storeLinks=page.locator('a[href="https://chromewebstore.google.com/detail/bbmbgcijgilijlmbplnijpbnedahfkkl"]');assert.equal(await storeLinks.count(),3,'homepage must expose the same official store listing in platform, FAQ and download sections');
      const palette=await page.evaluate(()=>({body:getComputedStyle(document.body).backgroundColor,primary:getComputedStyle(document.querySelector('.button.primary')).backgroundColor,hero:getComputedStyle(document.querySelector('.hero h1 span')).color,workflow:getComputedStyle(document.querySelector('.workflow-section')).backgroundColor}));
      assert.equal(palette.body,'rgb(248, 250, 252)');assert.equal(palette.primary,'rgb(37, 99, 235)');assert.equal(palette.hero,'rgb(37, 99, 235)');assert.equal(palette.workflow,'rgb(15, 43, 95)');
      await page.locator('summary').nth(1).click();await page.waitForFunction(()=>document.querySelectorAll('details[open]').length===1&&document.querySelectorAll('details')[1].open);
      await page.locator('summary').nth(2).click();await page.waitForFunction(()=>document.querySelectorAll('details[open]').length===1&&document.querySelectorAll('details')[2].open);
      assert.equal(await page.locator('input,textarea,form').count(),0);
      const exe=page.locator('a[href$=".exe"]');assert.equal(await exe.count(),1);assert.equal(await exe.getAttribute('href'),'https://github.com/ywu3309-afk/super-translate/releases/download/v0.7.38/SuperTranslate-Personal-Setup-0.7.38.exe');assert.match(await page.locator('#download').innerText(),/Windows\s*·\s*v0\.7\.38/);
      const apk=page.locator('a[href$=".apk"]');assert.equal(await apk.count(),2);assert.deepEqual(await apk.evaluateAll(links=>links.map(link=>link.href)),Array(2).fill('https://raw.githubusercontent.com/ywu3309-afk/super-translate/main/android/SuperTranslate-0.3.5.apk'));assert.match(await page.locator('#download').innerText(),/Android\s*·\s*v0\.3\.5/);
      await page.screenshot({path:path.join(out,`homepage-${width}.png`),fullPage:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,`hero-${width}.png`)});
      reports.push({...metrics,errors,remote,faqPassed:true,noForms:true,pricingPassed:true,palettePassed:true,browserExtension:'商店已上架',release:'v0.7.38',android:'v0.3.5 正式发布'});await page.close();
    }
    assert.equal(reports.length,5);
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({ok:true,at:new Date().toISOString(),reports},null,2));console.log(JSON.stringify({ok:true,reports},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
