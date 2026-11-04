(function(root) {
  'use strict';
  const defaults=Object.freeze({engine:'cloud',enabled:false,auto:false,autoSend:false,livePreview:true,replyMode:'follow',incoming:'zh-CN',outgoing:'en',tone:'natural'});
  const providers=Object.freeze({cloud:{label:'超级翻译智能 API'}});
  const languages=Object.freeze({'zh-CN':'中文（简体）','zh-TW':'中文（繁体）',en:'英语 English',es:'西班牙语 Español',fr:'法语 Français',de:'德语 Deutsch',pt:'葡萄牙语 Português',it:'意大利语 Italiano',ar:'阿拉伯语 العربية',ru:'俄语 Русский',tr:'土耳其语 Türkçe',nl:'荷兰语 Nederlands',pl:'波兰语 Polski',cs:'捷克语 Čeština',sk:'斯洛伐克语 Slovenčina',el:'希腊语 Ελληνικά',sq:'阿尔巴尼亚语 Shqip',th:'泰语 ไทย',vi:'越南语 Tiếng Việt',id:'印尼语 Bahasa Indonesia',ja:'日语 日本語',ko:'韩语 한국어'});
  const targets=Object.freeze({'zh-CN':'ZH-HANS','zh-TW':'ZH-HANT',en:'EN-US',es:'ES',fr:'FR',de:'DE',pt:'PT-PT',it:'IT',ar:'AR',ru:'RU',tr:'TR',nl:'NL',pl:'PL',cs:'CS',sk:'SK',el:'EL',sq:'SQ',th:'TH',vi:'VI',id:'ID',ja:'JA',ko:'KO'});
  function inspectText(text) {
    return /\bl9\s+busco\b/i.test(text)?['原文中的“l9 busco”疑似输入错误，请核对原文后重译。']:[];
  }
  function protect(input) {
    if(/ZXQKEEP\d+QXZ/i.test(input))throw new Error('原文含保留标记，请先移除 ZXQKEEP 标记。');
    const values=[];
    const re=/(?:\b(?:password|passwd|username|api[_ -]?key|token|mot\s+de\s+passe|nom\s+d['’]utilisateur|contraseña|usuario|senha|passwort|benutzername)\b|密码|用户名|密钥)\s*[:=：]\s*[^\r\n]+|https?:\/\/[^\s<>]+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|(?:[$€£]\s*\d+(?:[.,]\d+)*|\b\d+(?:[.,]\d+)*\s*[$€£])|\b\d+(?:[.,]\d+)*\b/gi;
    return {text:input.replace(re,value=>{const token=`ZXQKEEP${String(values.length).padStart(4,'0')}QXZ`;values.push({token,value});return token;}),values};
  }
  function restore(input,values) {
    if(typeof input!=='string'||!input.trim())throw new Error('翻译服务返回空结果。');
    let output=input;
    for(let i=0;i<values.length;i++){
      const {value}=values[i],regex=new RegExp(`ZXQ\\s*KEEP\\s*0*${i}\\s*QXZ`,'gi'),matches=output.match(regex)||[];
      if(matches.length!==1)throw new Error('译文改变了受保护的链接、数字或账号，已阻止使用。');
      output=output.replace(regex,()=>String(value));
    }
    if(/ZXQ\s*KEEP\s*0*\d+\s*QXZ/i.test(output))throw new Error('译文含未匹配保护标记，已阻止使用。');
    return output;
  }
  function normalizeSettings(value) {
    const valid=value?.engine==='cloud';
    return {...defaults,incoming:Object.hasOwn(languages,value?.incoming)?value.incoming:defaults.incoming,outgoing:Object.hasOwn(languages,value?.outgoing)?value.outgoing:defaults.outgoing,enabled:valid&&value.enabled===true,auto:valid&&value.auto===true,autoSend:valid&&value.autoSend===true,livePreview:value?.livePreview!==false,replyMode:value?.replyMode==='fixed'?'fixed':'follow'};
  }
  const api={defaults,providers,languages,targets,inspectText,protect,restore,normalizeSettings};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.WATCore=api;
})(globalThis);
