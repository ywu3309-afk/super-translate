const {_electron}=require('playwright'),path=require('path'),fs=require('fs'),assert=require('node:assert/strict');
const {prepareTestLogin,loginToWorkbench}=require('./login-helper.cjs');
(async()=>{
const output=path.resolve('../../outputs/超级翻译-修复版-0.4.2');fs.mkdirSync(output,{recursive:true});
const gguf=process.env.ST_TEST_GGUF||'D:\\BaiduNetdiskDownload\\HY-MT1.5-1.8B\\AI-Tran-V2\\ckpts\\Hy-MT2-1.8B-GGUF\\Hy-MT2-1.8B-Q4_K_M.gguf';assert.equal(fs.existsSync(gguf),true,'actual local GGUF fixture is missing');
const profile=path.resolve('../fixes-profile-'+Date.now()),login=await prepareTestLogin(profile);
const env={...process.env,ST_TEST_PROFILE:profile,ST_TEST_FIXTURE:'1',ST_CLOUD_BASE:login.cloudBase};delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('src/desktop.js')],env});const checks=[];const ok=(name,value)=>{assert.ok(value,name);checks.push(name);};
try{
const p=await app.firstWindow();await p.waitForLoadState('domcontentloaded');await loginToWorkbench(p,login);await p.evaluate(model=>window.superDesktop.saveSettings({engine:'local',model}),gguf);await p.evaluate(()=>window.superDesktop.startModel());await p.waitForFunction(()=>document.querySelector('#saved-status').textContent==='当前聊天已连接');
const wa=app.windows().find(p=>p.url().includes('wa-fixture.html'));await wa.waitForSelector('.st-translation');
ok('Default sequential account names',JSON.stringify(await p.locator('.account-caption').allTextContents())===JSON.stringify(['账号一','账号二']));
ok('History switch enabled in native-view mode',await p.locator('#translate-history').isEnabled());
await wa.evaluate(()=>{for(let i=2;i<=15;i++){const wrap=document.createElement('div');wrap.dataset.id='false_33600000101@c.us_test'+i;wrap.innerHTML='<div data-pre-plain-text="[10:00] Sample:"><span class="selectable-text">Hello, please wait a moment.</span></div>';document.querySelector('#main footer').before(wrap);}});
await wa.waitForFunction(()=>document.querySelectorAll('.st-translation').length===15);await p.locator('#translate-history').check();
await wa.waitForFunction(()=>[...document.querySelectorAll('.st-text')].filter(e=>e.textContent.startsWith('译文：')).length===15,null,{timeout:120000});
ok('All 15 loaded historical messages including offscreen translated using actual local model',await wa.locator('.st-text').first().textContent().then(t=>t.includes('稍等')));
await wa.evaluate(()=>{const el=document.querySelector('[data-id]');const copy=el.cloneNode(true);copy.querySelector('.st-translation').remove();el.replaceWith(copy);});
await wa.waitForFunction(()=>[...document.querySelectorAll('.st-text')].every(e=>e.textContent.startsWith('译文：')));ok('Remounted historical message translation restored',true);
await p.locator('#translate-history').uncheck();await wa.evaluate(()=>{const el=document.querySelector('[data-id]').cloneNode(true);el.dataset.id='false_33600000101@c.us_stop';el.querySelector('.st-translation').remove();el.querySelector('span').textContent='Hello after stop.';document.querySelector('#main footer').before(el);});await wa.waitForTimeout(2200);
ok('Switch off stops newly loaded history',await wa.locator('.st-text').last().textContent()==='');
await p.locator('.tool-button[data-tool="notes"]').click();ok('Phone inferred automatically from current chat identifier',await p.getByLabel('国际电话号码（可手动校正）').inputValue()==='+33600000101');
await p.getByRole('button',{name:'识别号码国家',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#phone-result').textContent.includes('已保存内部国家备注'));
ok('Country identification persisted and visibly acknowledged',(await p.locator('#phone-result').textContent()).includes('法国'));
await p.getByLabel('内部名称',{exact:true}).fill('本地测试备注');await p.getByLabel('内部备注',{exact:true}).fill('仅保存在超级翻译');await p.getByRole('button',{name:'保存内部备注',exact:true}).click();
await wa.waitForFunction(()=>document.querySelector('#st-contact-badge')?.textContent.includes('本地测试备注'));
const headerBadge=await wa.locator('#st-contact-badge').textContent();
ok('Saved private name and note remain available in native chat header',headerBadge.includes('本地测试备注')&&headerBadge.includes('仅保存在超级翻译'));
ok('Country attribution is not duplicated in native chat header',!headerBadge.includes('法国')&&!headerBadge.includes('号码归属'));
ok('Save feedback visible inside notes panel',(await p.locator('#phone-result').textContent()).includes('✓ 已保存'));
ok('Original WhatsApp header title unchanged',await wa.locator('header [title]').first().getAttribute('title')==='+33 6 00 00 01 01');
ok('Local note actually stored',await p.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('super-translate-workbench-v1')).liveProfiles).some(c=>c.note==='仅保存在超级翻译'&&c.country==='法国')));
await p.getByLabel('国际电话号码（可手动校正）').fill('+1');await p.getByRole('button',{name:'识别号码国家',exact:true}).click();await p.waitForTimeout(250);ok('Invalid phone has persistent visible error',!(await p.locator('#phone-result').textContent()).includes('正在读取'));
await p.locator('[data-tool="translation"]').click();await p.locator('#translate-history').check();
await p.reload();await p.waitForFunction(()=>document.body.classList.contains('live-mode'));await p.waitForFunction(()=>document.querySelector('#translate-history').checked);ok('History preference restored after reopening workbench',true);
await p.locator('.tool-button[data-tool="notes"]').click();ok('Saved internal name survives renderer reload',await p.getByLabel('内部名称',{exact:true}).inputValue()==='本地测试备注');
// Backward-compatible rename must not change partition IDs or erase annotations.
await p.evaluate(()=>{let s=JSON.parse(localStorage.getItem('super-translate-workbench-v1'));s.accounts[0].name='Super IPTV';s.accounts[1].name='car seat';localStorage.setItem('super-translate-workbench-v1',JSON.stringify(s));});await p.reload();await p.waitForFunction(()=>document.body.classList.contains('live-mode'));
ok('Legacy account captions migrated without changing IDs',await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('super-translate-workbench-v1'));return s.accounts[0].id==='a'&&s.accounts[1].id==='b'&&s.accounts[0].name==='账号一'&&s.accounts[1].name==='账号二';}));
await p.locator('[data-action="add-account"]').first().click();ok('Next account automatically named account three',await p.getByLabel('实例名称').inputValue()==='账号三');await p.getByRole('button',{name:'关闭',exact:true}).click();
ok('No customer messages sent',await wa.evaluate(()=>window.sentCount===0));
fs.writeFileSync(path.join(output,'修复回归验证.json'),JSON.stringify({version:'0.4.2',passed:checks.length,checks,surface:'Isolated WhatsApp DOM fixture with actual local model; not a live-customer-chat claim'},null,2));console.log(JSON.stringify({passed:checks.length,checks}));
}finally{await app.close();await login.closeCloud().catch(()=>{});}
})().catch(e=>{console.error(e);process.exit(1)});
