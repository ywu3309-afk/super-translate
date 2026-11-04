'use strict';
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
app.whenReady().then(async()=>{const win=new BrowserWindow({show:false,width:900,height:600,webPreferences:{preload:path.join(__dirname,'..','src','wa-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}});await win.loadFile(path.join(__dirname,'wa-country-fixture.html'));win.webContents.send('wa:identities',{rows:[{key:'false_4917668988346@c.us_header',hash:'header-contact',title:'+49 176 68988346',phone:'+4917668988346',country:'德国'}]});win.webContents.send('wa:command',{op:'profiles',id:'country-list-fixture',profiles:[{hash:'header-contact',name:'内部客户',country:'德国'},{hash:'ethiopia-contact',name:'埃塞测试客户',phone:'+251925626363',country:'埃塞俄比亚'}]});}).catch(error=>{console.error(error?.stack||error);app.exit(1);});
app.on('window-all-closed',()=>app.quit());
