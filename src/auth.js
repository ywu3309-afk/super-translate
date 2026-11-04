'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),{promisify}=require('node:util'),nativeGuard=require('./native-guard');
const scrypt=promisify(crypto.scrypt);
const parameters={N:32768,r:8,p:1,maxmem:64*1024*1024};
const identity=username=>typeof username==='string'?username.trim():'';
function authStore(directory){
  const file=path.join(directory,'local-admin-v1.json');
  function read(){
    if(!fs.existsSync(file))return null;
    let record;try{record=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw new Error('本地管理员数据损坏，请从备份恢复，不能跳过登录。');}
    if(record.version!==1||typeof record.username!=='string'||record.role!=='administrator'||!/^[a-f0-9]{32}$/.test(record.salt)||!/^[a-f0-9]{128}$/.test(record.hash))throw new Error('本地管理员记录无效，不能跳过登录。');
    return record;
  }
  function write(record,exclusive=false){
    fs.mkdirSync(directory,{recursive:true});
    if(exclusive){fs.writeFileSync(file,JSON.stringify(record,null,2),{encoding:'utf8',flag:'wx',mode:0o600});return;}
    const temp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(record,null,2),{encoding:'utf8',mode:0o600});fs.renameSync(temp,file);
  }
  let busy=false;
  async function create(username,password){
    username=identity(username);if(!/^[A-Za-z0-9_]{3,40}$/.test(username))throw new Error('账号须为 3–40 位字母、数字或下划线。');
    if(typeof password!=='string'||password.length<8||password.length>128)throw new Error('密码长度须为 8–128 位。');
    if(read())throw new Error('本机已存在管理员，未覆盖现有账号。');
    const salt=crypto.randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64,parameters)).toString('hex');
    write({version:1,username,role:'administrator',algorithm:'scrypt',salt,hash,createdAt:new Date().toISOString(),failures:0,blockedUntil:0},true);
    return{username,role:'administrator'};
  }
  async function login(username,password){
    if(nativeGuard.available())return nativeGuard.login(directory,username,password);
    if(busy)throw new Error('正在验证，请稍候。');busy=true;
    try{
      const r=read();if(!r)throw new Error('尚未配置本地管理员。');
      if(r.blockedUntil>Date.now())throw new Error('登录尝试过多，请在 15 分钟后重试。');
      if(typeof password!=='string'||password.length>128)throw new Error('账号或密码不正确。');
      const actual=await scrypt(password,r.salt,64,parameters),matches=crypto.timingSafeEqual(actual,Buffer.from(r.hash,'hex'));
      if(identity(username)!==r.username||!matches){r.failures=(r.blockedUntil&&r.blockedUntil<Date.now()?0:Number(r.failures)||0)+1;r.blockedUntil=r.failures>=5?Date.now()+15*60*1000:0;write(r);throw new Error('账号或密码不正确。');}
      if(r.failures||r.blockedUntil){r.failures=0;r.blockedUntil=0;write(r);}
      return {username:r.username,role:r.role};
    }finally{busy=false;}
  }
  return{create,login,required:()=>!!read(),file};
}
module.exports={authStore};
