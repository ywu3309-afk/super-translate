(function(root){
  'use strict';
  // `auto` is available for source-language detection. Translation targets
  // are kept in the same canonical code set as the desktop providers.
  const languages=Object.freeze({
    auto:'自动识别 (Auto)', en:'英语 (English)', es:'西班牙语 (Español)', fr:'法语 (Français)', de:'德语 (Deutsch)',
    pt:'葡萄牙语 (Português)', it:'意大利语 (Italiano)', ar:'阿拉伯语 (العربية)', ru:'俄语 (Русский)', tr:'土耳其语 (Türkçe)',
    nl:'荷兰语 (Nederlands)', pl:'波兰语 (Polski)', cs:'捷克语 (Čeština)', sk:'斯洛伐克语 (Slovenčina)',
    el:'希腊语 (Ελληνικά)', sq:'阿尔巴尼亚语 (Shqip)', th:'泰语 (ไทย)', vi:'越南语 (Tiếng Việt)', id:'印尼语 (Bahasa Indonesia)',
    ja:'日语 (日本語)', ko:'韩语 (한국어)', 'zh-CN':'中文 (简体)', 'zh-TW':'中文 (繁体)', hi:'印地语 (हिन्दी)', uk:'乌克兰语 (Українська)'
  });
  const targetLanguages=Object.freeze(Object.fromEntries(Object.entries(languages).filter(([code])=>code!=='auto')));
  const defaults={source:'auto',incoming:'zh-CN',outgoing:'fr',enabled:true,automatic:true,translateSend:true,blockChinese:true,history:false};
  const phrases=[
    {zh:'您好，请稍等，我现在帮您查看。',fr:'Bonjour, veuillez patienter un instant, je vais vérifier pour vous.',es:'Hola, espere un momento, voy a comprobarlo.',en:'Hello, please wait a moment while I check for you.',de:'Hallo, bitte warten Sie einen Moment. Ich prüfe das für Sie.',it:'Salve, attenda un momento, controllo per lei.',pt:'Olá, aguarde um momento enquanto verifico para você.'},
    {zh:'谢谢您的反馈，我会尽快确认。',fr:'Merci pour votre retour, je vais vérifier dès que possible.',es:'Gracias por sus comentarios. Lo confirmaré lo antes posible.',en:'Thank you for your feedback. I will confirm as soon as possible.',de:'Vielen Dank für Ihre Rückmeldung. Ich werde es so bald wie möglich bestätigen.'},
    {zh:'请问您需要多少件？',fr:'De combien de pièces avez-vous besoin ?',es:'¿Cuántas unidades necesita?',en:'How many units do you need?',de:'Wie viele Stück benötigen Sie?'},
    {zh:'好的，我已经收到您的消息。',fr:'D’accord, j’ai bien reçu votre message.',es:'De acuerdo, he recibido su mensaje.',en:'Okay, I have received your message.',de:'In Ordnung, ich habe Ihre Nachricht erhalten.'}
  ];
  const msg=(id,direction,foreign,chinese,time,extra={})=>({id,direction,foreign,chinese,time,...extra});
  function accountName(index){const n=index+1,d='零一二三四五六七八九';return '账号'+(n<10?d[n]:n<20?'十'+(n%10?d[n%10]:''):n<100?d[Math.floor(n/10)]+'十'+(n%10?d[n%10]:''):String(n));}
  function initial(){
    const accounts=[{id:'a',name:'账号一',platform:'whatsapp',url:'https://web.whatsapp.com/',partition:'persist:whatsapp',number:'尚未登录',short:'01',unread:2},{id:'b',name:'账号二',platform:'whatsapp',url:'https://web.whatsapp.com/',partition:'persist:super-wa-b',number:'尚未登录',short:'02',unread:1}];
    const specs=[
      ['fr01','a','+33 6 00 00 01 01','法国','fr','FR','Mon collègue vous demande.', '04:53',1,true],
      ['es01','a','+34 600 000 102','西班牙','es','ES','¿Podría enviarme el catálogo?', '04:51',1,false],
      ['de01','a','+49 151 0000 0103','德国','de','DE','Vielen Dank für Ihre Hilfe.', '04:48',0,true],
      ['fr02','a','+33 6 00 00 01 04','法国','fr','FR','D’accord, merci beaucoup.', '04:46',0,false],
      ['en01','a','+44 7700 900105','英国','en','GB','Could you check the delivery time?', '04:42',0,false],
      ['it01','a','+39 320 000 0106','意大利','it','IT','Vorrei maggiori informazioni.', '04:38',0,false],
      ['es02','a','+34 600 000 107','西班牙','es','ES','Perfecto, gracias.', '04:35',0,false],
      ['fr03','a','+33 6 00 00 01 08','法国','fr','FR','Je vous confirme demain.', '04:29',0,false],
      ['gr01','a','欧洲合作伙伴 · 示例群组','','en','GR','Thank you, everyone.', '昨天',0,false],
      ['en02','b','+44 7700 900201','英国','en','GB','Do you have black seat covers?', '09:24',1,true],
      ['de02','b','+49 151 0000 0202','德国','de','DE','Welche Farben sind verfügbar?', '09:19',0,false],
      ['es03','b','+34 600 000 203','西班牙','es','ES','¿Cuál es el plazo de entrega?', '昨天',0,false]
    ];
    const zh=['我的同事想问您。','可以发一份产品目录给我吗？','谢谢您的帮助。','好的，非常感谢。','可以查一下送达时间吗？','我想了解更多信息。','太好了，谢谢。','我明天向您确认。','谢谢大家。','有黑色座椅套吗？','有哪些颜色可选？','交货周期是多久？'];
    const contacts=specs.map((s,i)=>({id:s[0],account:s[1],number:s[2],country:s[3],lang:s[4],avatar:s[5],preview:s[6],time:s[7],unread:s[8],star:s[9],group:s[0]==='gr01',archived:false,internalName:'',note:'',tags:i===0?'待跟进,老客户':'',status:'待跟进',messages:[msg(s[0]+'-1','in',s[6],zh[i],s[7])]}));
    contacts[0].messages=[
      msg('fr1','in','Bonjour, est-ce que le catalogue est à jour ?','您好，产品目录是最新的吗？','04:35'),
      msg('fr2','out','Bonjour, oui, c’est notre dernier catalogue.','您好，是的，这是我们最新的产品目录。','04:36'),
      msg('fr3','in','Pouvez-vous m’envoyer les détails du produit ?','可以把产品的详细信息发给我吗？','04:38'),
      msg('fr4','out','Bien sûr. Quel modèle vous intéresse ?','当然可以。您对哪款型号感兴趣？','04:39'),
      msg('fr5','in','Je voudrais connaître le délai de livraison.','我想了解一下送货时间。','04:42',{voice:true,duration:'0:08'}),
      msg('fr6','out','Je vais vérifier le délai de livraison pour vous.','我帮您确认一下送货时间。','04:45'),
      msg('fr7','in','D’accord, merci pour votre aide.','好的，谢谢您的帮助。','04:49'),
      msg('fr8','in','Mon collègue vous demande.','我的同事想问您。','04:53')
    ];
    return {version:1,accounts,contacts,selectedAccount:'a',selectedContact:'fr01',globalRules:{...defaults,useContactLanguage:true},rules:{},drafts:{},quick:phrases.map(p=>p.zh),liveProfiles:{}};
  }
  function normalizeTarget(value,fallback){return value&&value!=='auto'&&Object.prototype.hasOwnProperty.call(targetLanguages,value)?value:fallback;}
  function normalizeRules(value){const merged={...defaults,...(value||{})};merged.source=Object.prototype.hasOwnProperty.call(languages,merged.source)?merged.source:'auto';merged.incoming=normalizeTarget(merged.incoming,'zh-CN');merged.outgoing=normalizeTarget(merged.outgoing,'fr');return merged;}
  // Keep the persisted safety preference untouched, but do not ask the
  // WhatsApp interceptor to reject a Chinese translation when Chinese itself
  // is the selected target language.
  function effectiveLiveRules(value){const rules=normalizeRules(value);return {...rules,blockChinese:/^zh-(?:CN|TW)$/.test(rules.outgoing)?false:rules.blockChinese};}
  function rulesFor(state,contact,scope='contact'){
    if(scope==='global')return normalizeRules({...state.globalRules});
    const merged={...state.globalRules,outgoing:state.globalRules.useContactLanguage?(contact?.lang||state.globalRules.outgoing):state.globalRules.outgoing,...state.rules[contact?.id]};
    return normalizeRules(merged);
  }
  function demoTranslation(text,target){
    const p=phrases.find(p=>p.zh===String(text).trim());
    if(!p||!p[target])throw new Error('浏览器演示只提供快捷回复中的示例对照；任意文本请在桌面版中连接本地翻译引擎。');
    return p[target];
  }
  function validateSend(text,rules){
    if(!String(text||'').trim())throw new Error('译文为空，不能发送。');
    if(rules.blockChinese&&/[\u3400-\u9fff]/u.test(text))throw new Error('中文拦截：待发内容仍包含中文，请先生成外语译文。');
    return true;
  }
  function scopedDraft(state,account,contact){const key=account+':'+contact;return state.drafts[key]||'';}
  const api={accountName,initial,rulesFor,effectiveLiveRules,languages,targetLanguages,normalizeTarget,phrases,demoTranslation,validateSend,scopedDraft};
  if(typeof module==='object')module.exports=api;root.WorkbenchModel=api;
})(globalThis);
