(function(root){
  'use strict';
  // Allow-listed platform metadata.  Logos are presentation-only; the URL,
  // driver selectors and partition identity remain controlled by the app.
  const logos={
    whatsapp:'https://cdn.simpleicons.org/whatsapp/25D366',
    whatsappMulti:'https://cdn.simpleicons.org/whatsapp/128C7E',
    telegram:'https://cdn.simpleicons.org/telegram/26A5E4',
    messenger:'https://cdn.simpleicons.org/messenger/00B2FF',
    instagram:'https://cdn.simpleicons.org/instagram/E4405F',
    line:'https://cdn.simpleicons.org/line/00C300',
    zalo:'https://cdn.simpleicons.org/zalo/0068FF',
    facebook:'https://cdn.simpleicons.org/facebook/0866FF',
    meta:'https://cdn.simpleicons.org/meta/0081FB',
    linkedin:'https://cdn.simpleicons.org/linkedin/0A66C2',
    x:'https://cdn.simpleicons.org/x/000000',
    discord:'https://cdn.simpleicons.org/discord/5865F2',
    googleVoice:'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Google_Voice_icon_%282020%29.svg/512px-Google_Voice_icon_%282020%29.svg.png',
    tiktok:'https://cdn.simpleicons.org/tiktok/000000',
    snapchat:'https://cdn.simpleicons.org/snapchat/FFFC00',
    textnow:'https://upload.wikimedia.org/wikipedia/commons/e/e6/TextNow_Logo.png',
    botim:'https://botim.me/favicon.ico',
    lineWorks:'https://upload.wikimedia.org/wikipedia/commons/c/c9/LINE_WORKS_logo.png',
    googleChat:'https://cdn.simpleicons.org/googlechat/00AC47',
    tinder:'https://cdn.simpleicons.org/tinder/FF6B6B',
    index:'https://play-lh.googleusercontent.com/L12l9QvCjhvVqZ31Q4tYlQ-lqP4eR8o5w=w240-h240',
    textfree:'https://play-lh.googleusercontent.com/8a6M4IqgA_y2oP0s9Y6p_g_2s0=w240-h240',
    vk:'https://cdn.simpleicons.org/vk/0077FF',
    bip:'https://cdn.simpleicons.org/bip/00ADEF',
    teams:'https://cdn.simpleicons.org/microsoftteams/6264A7',
    max:'https://cdn.simpleicons.org/max/000000'
  };
  // `allowedHosts` is deliberately separate from `url`: Meta login flows
  // move between messenger.com, facebook.com and business.facebook.com while
  // the service instance must still remain on a small, explicit origin list.
  // `messages`/`messageText` are scoped selectors used by the non-WhatsApp
  // receive-side translator; they must never become a page-wide text scrape.
  const generic={input:'div[contenteditable="true"][role="textbox"], textarea, input[type="text"]',sendBtn:'button[type="submit"],button[aria-label*="发送"],button[aria-label*="Send"]',contactTitle:'header h1, header h2, header span, [role="main"] h1, [role="main"] span'};
  const metaHosts=['messenger.com','www.messenger.com','facebook.com','www.facebook.com','m.facebook.com','business.facebook.com','login.facebook.com'];
  const telegramHosts=['web.telegram.org'];
  const registry=Object.freeze({
    whatsapp:{name:'WhatsApp',icon:logos.whatsapp,iconFallback:'WA',url:'https://web.whatsapp.com/',selectors:{input:'div[contenteditable="true"][role="textbox"], div[contenteditable="true"][data-tab="10"]',sendBtn:'span[data-icon="send"]',contactTitle:'header div[role="button"] span[dir="auto"]'}},
    whatsapp_multi:{name:'WhatsApp 多功能',icon:logos.whatsappMulti,iconFallback:'WA',url:'https://web.whatsapp.com/',selectors:{input:'div[contenteditable="true"][role="textbox"], div[contenteditable="true"][data-tab="10"]',sendBtn:'span[data-icon="send"]',contactTitle:'header div[role="button"] span[dir="auto"]'}},
    telegram:{name:'Telegram',icon:logos.telegram,iconFallback:'TG',url:'https://web.telegram.org/',allowedHosts:telegramHosts,selectors:{input:'.input-message-input[contenteditable="true"], #editable-message-text[contenteditable="true"]',sendBtn:'.btn-send, button.send',contactTitle:'.chat-info .person .title, .chat-info-name',messages:'.bubble, .bubble-content, .message',messageText:'.message-text, .text-content, .bubble-content, .text-content'}},
    telegram_k:{name:'Telegram K',icon:logos.telegram,iconFallback:'TG',url:'https://web.telegram.org/k/',allowedHosts:telegramHosts,selectors:{input:'.input-message-input[contenteditable="true"]',sendBtn:'.btn-send',contactTitle:'.chat-info .person .title',messages:'.bubble, .bubble-content, .message',messageText:'.message-text, .text-content, .bubble-content'}},
    telegram_z:{name:'Telegram Z',icon:logos.telegram,iconFallback:'TG',url:'https://web.telegram.org/a/',allowedHosts:telegramHosts,selectors:{input:'#editable-message-text[contenteditable="true"]',sendBtn:'button.send',contactTitle:'.chat-info-name',messages:'.bubble, .bubble-content, .message',messageText:'.message-text, .text-content, .bubble-content'}},
    facebook:{name:'Facebook',icon:logos.facebook,iconFallback:'f',url:'https://www.facebook.com/',allowedHosts:metaHosts,selectors:{...generic,messages:'[role="main"] [data-testid*="message"]',messageText:'[data-testid*="message-text"], [data-testid*="message"] span[dir="auto"]'}},
    messenger:{name:'Messenger',icon:logos.messenger,iconFallback:'M',url:'https://www.messenger.com/',allowedHosts:metaHosts,selectors:{input:'div[role="textbox"][contenteditable="true"]',sendBtn:'div[aria-label*="发送"], div[aria-label*="Press Enter"]',contactTitle:'header h2, div[role="main"] span[dir="auto"]',messages:'[data-testid*="message-container"], [data-testid*="message"]',messageText:'[data-testid="message-text"], [data-testid*="message"] span[dir="auto"]'}},
    instagram:{name:'Instagram Direct',icon:logos.instagram,iconFallback:'IG',url:'https://www.instagram.com/direct/inbox/',selectors:{input:'div[role="textbox"][contenteditable="true"]',sendBtn:'button[type="button"]',contactTitle:'header span'}},
    line_generic:{name:'LINE',icon:logos.line,iconFallback:'L',url:'https://line.me/',selectors:{input:'textarea, div[contenteditable="true"]',sendBtn:'button.send',contactTitle:'.chat-header__title, header span'}},
    line_works:{name:'LINE WORKS',icon:logos.lineWorks,iconFallback:'LW',url:'https://auth.worksmobile.com/',selectors:generic},
    line:{name:'LINE 商用',icon:logos.line,iconFallback:'L',url:'https://chat.line.biz/',selectors:{input:'textarea, div[contenteditable="true"]',sendBtn:'button.send',contactTitle:'.chat-header__title'}},
    zalo:{name:'Zalo',icon:logos.zalo,iconFallback:'Z',url:'https://chat.zalo.me/',selectors:{input:'#richInput',sendBtn:'.btn-send',contactTitle:'.header-title'}},
    facebook_page:{name:'Facebook 粉丝专页',icon:logos.meta,iconFallback:'f',url:'https://business.facebook.com/latest/inbox/',allowedHosts:metaHosts,selectors:{input:'div[contenteditable="true"][role="textbox"]',sendBtn:'button[aria-label*="发送"], button[aria-label*="Send"]',contactTitle:'div[role="main"] h1, header span',messages:'[role="main"] [data-testid*="message"]',messageText:'[data-testid*="message-text"], [data-testid*="message"] span[dir="auto"]'}},
    twitter:{name:'Twitter / X 私信',icon:logos.x,iconFallback:'X',url:'https://x.com/messages',selectors:{input:'div[role="textbox"][contenteditable="true"]',sendBtn:'button[data-testid="dmComposerSendButton"]',contactTitle:'[data-testid="conversationHeader"]'}},
    discord:{name:'Discord',icon:logos.discord,iconFallback:'DS',url:'https://discord.com/channels/@me',selectors:{input:'div[role="textbox"][contenteditable="true"]',sendBtn:null,contactTitle:'h1[aria-label]'}},
    linkedin:{name:'LinkedIn',icon:logos.linkedin,iconFallback:'in',url:'https://www.linkedin.com/messaging/',allowedHosts:['linkedin.com','www.linkedin.com'],selectors:generic},
    google_chat:{name:'Google Chat',icon:logos.googleChat,iconFallback:'GC',url:'https://chat.google.com/',selectors:generic},
    google_voice:{name:'Google Voice',icon:logos.googleVoice,iconFallback:'GV',url:'https://voice.google.com/messages',selectors:{input:'textarea[aria-label*="消息"], textarea[aria-label*="Message"]',sendBtn:'button[aria-label*="发送"], button[aria-label*="Send"]',contactTitle:'header .title'}},
    tinder:{name:'Tinder',icon:logos.tinder,iconFallback:'T',url:'https://tinder.com/',selectors:generic},
    tiktok:{name:'TikTok',icon:logos.tiktok,iconFallback:'TT',url:'https://www.tiktok.com/messages',selectors:{input:'div[contenteditable="true"],textarea',sendBtn:'button',contactTitle:'header span'}},
    snapchat:{name:'Snapchat',icon:logos.snapchat,iconFallback:'SC',url:'https://web.snapchat.com/',selectors:{input:'div[contenteditable="true"],textarea',sendBtn:'button',contactTitle:'header span'}},
    textnow:{name:'TextNow',icon:logos.textnow,iconFallback:'TN',url:'https://www.textnow.com/messaging',selectors:{input:'textarea, div[contenteditable="true"]',sendBtn:'button',contactTitle:'header span'}},
    index:{name:'Index (by Pinger)',icon:logos.index,iconFallback:'IX',url:'https://www.pinger.com/index/',selectors:generic},
    textfree:{name:'Textfree',icon:logos.textfree,iconFallback:'TF',url:'https://messages.textfree.us/',selectors:generic},
    vk:{name:'VK (VKontakte)',icon:logos.vk,iconFallback:'VK',url:'https://vk.com/im',selectors:generic},
    bip:{name:'BiP',icon:logos.bip,iconFallback:'BP',url:'https://web.bip.com/',selectors:generic},
    botim:{name:'Botim',icon:logos.botim,iconFallback:'BT',url:'https://web.botim.me/',selectors:{input:'textarea, div[contenteditable="true"]',sendBtn:'button',contactTitle:'header span'}},
    microsoft_teams:{name:'Microsoft Teams',icon:logos.teams,iconFallback:'MS',url:'https://teams.microsoft.com/',selectors:generic},
    max:{name:'Max',icon:logos.max,iconFallback:'MX',url:'https://www.max.com/',selectors:generic}
  });
  const keys=Object.freeze(Object.keys(registry));
  function get(key){return registry[key]||null;}
  function createDriver(key){
    const config=get(key);if(!config)return null;
    return Object.freeze({...config,getInputEl(root){const doc=root||(typeof document==='object'?document:null);if(!doc)return null;return doc.querySelector(config.selectors.input);},getContactInfo(root){const doc=root||(typeof document==='object'?document:null);const el=doc?.querySelector(config.selectors.contactTitle);return String(el?.textContent||el?.getAttribute?.('aria-label')||'').trim();},triggerSend(root){const doc=root||(typeof document==='object'?document:null);if(!doc)return false;const selector=config.selectors.sendBtn,button=selector&&doc.querySelector(selector);if(button){button.click();return true;}const target=this.getInputEl(doc);target?.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));return !!target;}});
  }
  const drivers=Object.freeze(Object.fromEntries(keys.map(key=>[key,createDriver(key)])));
  const api={registry,keys,get,drivers};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.PlatformRegistry=api;
})(globalThis);
