// Local provisioning only. Credentials arrive over stdin and are never printed.
const {authStore}=require('../src/auth');const path=require('node:path');
let text='';process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{text+=chunk;if(text.length>4096){process.exitCode=1;process.stdin.destroy();return;}const end=text.indexOf('\n');if(end>=0){const line=text.slice(0,end);text='';process.stdin.pause();run(line);}});
async function run(line){try{const payload=JSON.parse(line);const dir=path.resolve(process.argv[2]);const store=authStore(dir);let account;
  if(store.required()){account=await store.login(payload.username,payload.password);}else account=await store.create(payload.username,payload.password);
  await store.login(payload.username,payload.password);payload.password='';console.log(JSON.stringify({ok:true,username:account.username,role:account.role,loginVerified:true}));process.exit(0);
}catch{console.error('Provisioning failed; existing account was not overwritten.');process.exit(1);}}
