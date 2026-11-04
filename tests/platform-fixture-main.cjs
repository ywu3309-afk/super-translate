'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path');
let windowRef;
function store(name,value){
  if(!windowRef||windowRef.isDestroyed())return;
  const encoded=JSON.stringify(value).replace(/</g,'\\u003c');
  windowRef.webContents.executeJavaScript(`window.__platformEvents=window.__platformEvents||{};window.__platformEvents[${JSON.stringify(name)}]=${encoded};`,true).catch(()=>{});
}
app.whenReady().then(()=>{
  ipcMain.handle('desktop:platform-translate',async(_event,input)=>({translation:String(input?.target||'').startsWith('zh')?'来自 Telegram 的中文译文':'Translated Telegram reply'}));
  ipcMain.on('platform:snapshot',(_event,data)=>store('snapshot',data));
  ipcMain.on('platform:composer-preview',(_event,data)=>store('preview',data));
  ipcMain.on('platform:response',(_event,data)=>{console.log('platform-response',JSON.stringify(data));store('response-'+String(data?.id||''),data);});
  windowRef=new BrowserWindow({show:false,width:640,height:480,webPreferences:{preload:path.join(__dirname,'..','src','platform-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}});
  windowRef.loadFile(path.join(__dirname,'platform-fixture.html')).then(()=>{windowRef.webContents.send('platform:command',{id:'init',op:'init',driver:{name:'Telegram K',selectors:{input:'.input-message-input[contenteditable="true"]',sendBtn:'.btn-send',contactTitle:'.chat-info .person .title',messages:'.message',messageText:'.message-text'}},config:{incoming:'zh-CN',outgoing:'en',outgoingLabel:'英语',automatic:true,translateSend:true,blockChinese:true}});setTimeout(()=>windowRef.webContents.send('platform:command',{id:'config',op:'config',config:{incoming:'zh-CN',outgoing:'en',outgoingLabel:'英语',automatic:true,translateSend:true,blockChinese:true}}),150);});
});
app.on('window-all-closed',()=>app.quit());
