'use strict';
const fs = require('fs');
const path = require('path');
const {parsePhoneNumberFromString} = require('libphonenumber-js');
const defaults = () => ({engine:'local', incoming:'zh-CN', outgoing:'en', auto:false,
  // Model paths are per-machine and must never ship with a developer-specific
  // drive.  One-click import writes the selected GGUF into userData/models.
  python:'', model:'',
  asrModel:'', deeplEncrypted:'', deeplPro:false, localPort:31948});
// One canonical set of target codes is used by the workbench, persisted
// contact profiles and both translation engines. `auto` is intentionally not
// a target: it is only meaningful in the source-language selector.
const LANGUAGES = Object.freeze({
  en:'英语 (English)',es:'西班牙语 (Español)',fr:'法语 (Français)',de:'德语 (Deutsch)',pt:'葡萄牙语 (Português)',it:'意大利语 (Italiano)',
  ar:'阿拉伯语 (العربية)',ru:'俄语 (Русский)',tr:'土耳其语 (Türkçe)',nl:'荷兰语 (Nederlands)',pl:'波兰语 (Polski)',cs:'捷克语 (Čeština)',
  sk:'斯洛伐克语 (Slovenčina)',el:'希腊语 (Ελληνικά)',sq:'阿尔巴尼亚语 (Shqip)',th:'泰语 (ไทย)',vi:'越南语 (Tiếng Việt)',id:'印尼语 (Bahasa Indonesia)',
  ja:'日语 (日本語)',ko:'韩语 (한국어)','zh-CN':'中文 (简体)','zh-TW':'中文 (繁体)',hi:'印地语 (हिन्दी)',uk:'乌克兰语 (Українська)'
});
const DEEPL_TARGETS = Object.freeze({
  en:'EN-US',es:'ES',fr:'FR',de:'DE',pt:'PT-PT',it:'IT',ar:'AR',ru:'RU',tr:'TR',nl:'NL',pl:'PL',cs:'CS',sk:'SK',el:'EL',sq:'SQ',th:'TH',vi:'VI',id:'ID',ja:'JA',ko:'KO','zh-CN':'ZH-HANS','zh-TW':'ZH-HANT',hi:'HI',uk:'UK'
});
const LOCAL_TARGET_NAMES = Object.freeze({
  en:'English',es:'Spanish',fr:'French',de:'German',pt:'Portuguese',it:'Italian',ar:'Arabic',ru:'Russian',tr:'Turkish',nl:'Dutch',pl:'Polish',cs:'Czech',sk:'Slovak',el:'Greek',sq:'Albanian',th:'Thai',vi:'Vietnamese',id:'Indonesian',ja:'Japanese',ko:'Korean','zh-CN':'Simplified Chinese','zh-TW':'Traditional Chinese',hi:'Hindi',uk:'Ukrainian'
});
const countryLang = {CN:'zh-CN',TW:'zh-TW',HK:'zh-TW',US:'en',CA:'en',GB:'en',AU:'en',NZ:'en',ES:'es',MX:'es',CO:'es',AR:'es',CL:'es',PE:'es',FR:'fr',DE:'de',AT:'de',CH:'de',IT:'it',PT:'pt',BR:'pt',SA:'ar',AE:'ar',EG:'ar',JP:'ja',KR:'ko',RU:'ru',TR:'tr',ID:'id',VN:'vi',TH:'th',NL:'nl',PL:'pl',CZ:'cs',SK:'sk',GR:'el',AL:'sq',IN:'hi',UA:'uk'};
function phoneInfo(value){
  const text=String(value||'').trim();
  if(!/^\+\d[\d ()-]{5,24}$/.test(text)) return {number:text,country:'',label:'需要含 + 国际区号的完整号码',language:'',source:'unknown'};
  const p=parsePhoneNumberFromString(text); if(!p||!p.isPossible())return {number:text,country:'',label:'号码长度或国际区号无效',language:'',source:'unknown'};
  const c=p.country||'';
  return {number:p.number,country:c,label:c==='CN'?'中国大陆':c?new Intl.DisplayNames(['zh-CN'],{type:'region'}).of(c):`共享区号 +${p.countryCallingCode}，国家不确定`,language:countryLang[c]||'',source:'phone-prefix',warning:'仅推断号码所属国家，不代表客户所在地或实际语言。'};
}
function store(directory){
  fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'workspace-v2.json');
  let data={settings:defaults(),contacts:{},quickReplies:['您好，请稍等，我现在帮您查看。','谢谢您的反馈，我会尽快确认。'],terms:[],proxyProfiles:{}};
  if(fs.existsSync(file)){
    try {const old=JSON.parse(fs.readFileSync(file,'utf8'));data={...data,...old,settings:{...defaults(),...old.settings},proxyProfiles:old.proxyProfiles&&typeof old.proxyProfiles==='object'?old.proxyProfiles:{}};}
    catch {fs.copyFileSync(file,file+'.corrupt-'+Date.now());}
  }
  function save(){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2),'utf8');if(fs.existsSync(file))fs.copyFileSync(file,file+'.bak');fs.renameSync(tmp,file);}
  return {get:()=>data,save,file};
}
function cleanContact(input){
  if(!input||typeof input!=='object')throw new Error('客户资料格式错误');
  const out={};
  for(const [field,max] of Object.entries({internalName:100,phone:30,note:5000,tags:250,language:12,status:30,originalName:150}))out[field]=String(input[field]||'').slice(0,max);
  if(out.language&&!LANGUAGES[out.language])throw new Error('不支持的客户语言');
  out.updatedAt=new Date().toISOString(); return out;
}
module.exports={store,defaults,phoneInfo,LANGUAGES,DEEPL_TARGETS,LOCAL_TARGET_NAMES,cleanContact};
