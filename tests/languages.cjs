'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Data=require('../src/data');
const Core=require('../src/text-core');
const Model=require('../src/workbench/model');

const sourceCodes=['auto','en','es','fr','de','pt','it','ar','ru','tr','nl','pl','cs','sk','el','sq','th','vi','id','ja','ko','zh-CN','zh-TW','hi','uk'];
const targetCodes=sourceCodes.slice(1);
const labels={
  auto:'自动识别 (Auto)',en:'英语 (English)',es:'西班牙语 (Español)',fr:'法语 (Français)',de:'德语 (Deutsch)',pt:'葡萄牙语 (Português)',it:'意大利语 (Italiano)',
  ar:'阿拉伯语 (العربية)',ru:'俄语 (Русский)',tr:'土耳其语 (Türkçe)',nl:'荷兰语 (Nederlands)',pl:'波兰语 (Polski)',cs:'捷克语 (Čeština)',
  sk:'斯洛伐克语 (Slovenčina)',el:'希腊语 (Ελληνικά)',sq:'阿尔巴尼亚语 (Shqip)',th:'泰语 (ไทย)',vi:'越南语 (Tiếng Việt)',id:'印尼语 (Bahasa Indonesia)',
  ja:'日语 (日本語)',ko:'韩语 (한국어)','zh-CN':'中文 (简体)','zh-TW':'中文 (繁体)',hi:'印地语 (हिन्दी)',uk:'乌克兰语 (Українська)'
};
const deepl={en:'EN-US',es:'ES',fr:'FR',de:'DE',pt:'PT-PT',it:'IT',ar:'AR',ru:'RU',tr:'TR',nl:'NL',pl:'PL',cs:'CS',sk:'SK',el:'EL',sq:'SQ',th:'TH',vi:'VI',id:'ID',ja:'JA',ko:'KO','zh-CN':'ZH-HANS','zh-TW':'ZH-HANT',hi:'HI',uk:'UK'};
const local={en:'English',es:'Spanish',fr:'French',de:'German',pt:'Portuguese',it:'Italian',ar:'Arabic',ru:'Russian',tr:'Turkish',nl:'Dutch',pl:'Polish',cs:'Czech',sk:'Slovak',el:'Greek',sq:'Albanian',th:'Thai',vi:'Vietnamese',id:'Indonesian',ja:'Japanese',ko:'Korean','zh-CN':'Simplified Chinese','zh-TW':'Traditional Chinese',hi:'Hindi',uk:'Ukrainian'};
let passed=0;
function same(name,actual,expected){assert.deepEqual(actual,expected,name);passed++;}
function yes(name,value){assert.ok(value,name);passed++;}
function options(file,id){
  const html=fs.readFileSync(file,'utf8');
  const select=html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`));
  assert.ok(select,`${id} missing in ${file}`);
  return [...select[1].matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)].map(([,value,label])=>({value,label}));
}

(async()=>{
  same('desktop language codes',Object.keys(Data.LANGUAGES),targetCodes);
  same('desktop DeepL capability map',Data.DEEPL_TARGETS,deepl);
  same('desktop local-model target names',Data.LOCAL_TARGET_NAMES,local);
  same('shared pipeline language codes',Object.keys(Core.languages),targetCodes);
  same('shared pipeline DeepL codes',Core.deeplTargetCodes,deepl);
  same('shared pipeline local targets',Core.localTargetNames,local);
  same('workbench exposes Auto, 22 requested and 2 compatible targets',Object.keys(Model.languages),sourceCodes);
  same('workbench target list cannot contain Auto',Object.keys(Model.targetLanguages),targetCodes);
  for(const code of sourceCodes)same(`label ${code}`,Model.languages[code],labels[code]);

  for(const file of [path.resolve(__dirname,'../src/workbench/index.html'),path.resolve(__dirname,'../../super-translate-ui/index.html')]){
    same(`${path.basename(path.dirname(file))} source selector`,options(file,'source-language').map(o=>o.value),sourceCodes);
    same(`${path.basename(path.dirname(file))} incoming selector`,options(file,'incoming-language').map(o=>o.value),targetCodes);
    same(`${path.basename(path.dirname(file))} outgoing selector`,options(file,'outgoing-language').map(o=>o.value),targetCodes);
    for(const {value,label} of options(file,'source-language'))same(`${path.basename(path.dirname(file))} label ${value}`,label,labels[value]);
  }

  const state=Model.initial();state.globalRules={...state.globalRules,useContactLanguage:false,outgoing:'auto',incoming:'auto',source:'bogus'};
  const normalized=Model.rulesFor(state,state.contacts[0],'global');
  same('Auto cannot become an outgoing target',normalized.outgoing,'fr');
  same('Auto cannot become an incoming target',normalized.incoming,'zh-CN');
  same('unknown source falls back to Auto',normalized.source,'auto');
  const chineseEffective=Model.effectiveLiveRules({...normalized,outgoing:'zh-TW',blockChinese:true});
  same('Chinese target disables only the effective live Chinese guard',chineseEffective.blockChinese,false);
  same('Persisted Chinese guard preference is not mutated',normalized.blockChinese,true);
  same('Foreign target keeps the effective Chinese guard',Model.effectiveLiveRules({...normalized,outgoing:'en',blockChinese:true}).blockChinese,true);
  await assert.rejects(()=>Core.translate({text:'test',target:'auto',settings:{engine:'local'}},async()=>{throw new Error('fetch must not run');}),/不支持的目标语言/);passed++;

  for(const code of targetCodes){
    let localRequest;
    await Core.translate({text:'test',target:code,settings:{engine:'local'}},async(url,init)=>{localRequest={url,body:JSON.parse(init.body)};return{ok:true,json:async()=>({translation:'translated'})};});
    same(`local target ${code}`,localRequest.body.target,local[code]);
    let deeplRequest;
    await Core.translate({text:'test',target:code,settings:{engine:'deepl'},key:'test:fx'},async(url,init)=>{deeplRequest={url,body:JSON.parse(init.body)};return{ok:true,json:async()=>({translations:[{text:'translated',detected_source_language:'EN'}]})};});
    same(`DeepL target ${code}`,deeplRequest.body.target_lang,deepl[code]);
  }
  await assert.rejects(()=>Core.translate({text:'test',target:'sq',settings:{engine:'deepl'},key:'test:fx'},async()=>({ok:false,status:400,json:async()=>({})})),/DeepL 拒绝了该目标语言或请求参数/);passed++;
  const protectedValues=Core.protect('DINO 120 个学分，12 个学分等于 6 个月，最低 1 个学分价格是 200。');
  const reordered=`DINO zxq KEEP 0 0 0 4 qxz 个学分，ZXQ KEEP 0 0 0 0 QXZ 个学分等于 ZXQKEEP0002QXZ 个月，最低 ZXQKEEP0001QXZ 个学分价格是 ZXQKEEP0003QXZ。`;
  same('numeric protection restores reordered and formatted markers',Core.restore(reordered,protectedValues.values),'DINO 200 个学分，120 个学分等于 6 个月，最低 12 个学分价格是 1。');
  assert.throws(()=>Core.restore(reordered.replace('ZXQKEEP0002QXZ','ZXQKEEP0001QXZ'),protectedValues.values),/受保护/);passed++;
  assert.throws(()=>Core.restore(`${reordered} ZXQKEEP9999QXZ`,protectedValues.values),/保护标记/);passed++;

  // Representative country-to-language defaults added with this language set.
  same('Czech phone defaults to Czech',Data.phoneInfo('+420 601 123 456').language,'cs');
  same('Slovak phone defaults to Slovak',Data.phoneInfo('+421 901 123 456').language,'sk');
  same('Albanian phone defaults to Albanian',Data.phoneInfo('+355 67 123 4567').language,'sq');
  const currentWa=fs.readFileSync(path.resolve(__dirname,'../src/wa-preload.js'),'utf8');
  // Source-language detection belongs to the translation backend.  Guard the
  // required contract directly instead of pinning the complete interceptor to
  // an obsolete Chinese-only implementation from v0.7.15.
  yes('WhatsApp composer translates every non-empty source',/function scheduleComposerTranslation[\s\S]*composerState=\{chat:chatKey,original:text,translated:'',status:'waiting'/.test(currentWa));
  yes('WhatsApp send path has no non-Chinese bypass',!/if\(!chineseText\(text\)\).*return false/.test(currentWa));
  yes('WhatsApp send path no longer rejects non-Chinese drafts',!/草稿已经不是中文/.test(currentWa));
  console.log(JSON.stringify({passed,requestedTargets:22,compatibleTargets:2,targetLanguages:targetCodes.length,sourceOptions:sourceCodes.length}));
})().catch(error=>{console.error(error);process.exit(1);});
