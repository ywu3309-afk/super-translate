'use strict';
// Verifies the bundled Windows CPU runtime without requiring Python.  The
// 1.1-GB GGUF is intentionally not checked into the repository; set ST_MODEL
// to run the optional inference smoke test locally.  Never persist a
// developer-specific model path in source control.
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');

const root=path.resolve(__dirname,'..');
const exe=path.join(root,'runtime','llama-cpp','llama-server.exe');
assert.ok(fs.existsSync(exe),'bundled llama-server.exe is missing');
const versionRun=spawnSync(exe,['--version'],{encoding:'utf8',timeout:15000,windowsHide:true});
const version=String(versionRun.stdout||'')+String(versionRun.stderr||'');
assert.equal(versionRun.status,0,'llama-server --version failed');
assert.match(version,/build\s+10865/i,'unexpected llama.cpp runtime build');

const candidate=String(process.env.ST_MODEL||'').trim();
if(!fs.existsSync(candidate)){
  console.log(JSON.stringify({ok:true,runtime:'llama.cpp',version:version.trim(),inference:'skipped',reason:'GGUF model not supplied'}));
  process.exit(0);
}

const port=31960+Math.floor(Math.random()*200);
const child=spawn(exe,['--model',path.resolve(candidate),'--host','127.0.0.1','--port',String(port),'--ctx-size','4096','--threads','4','--n-gpu-layers','0','--parallel','1','--alias','super-translate'],{cwd:path.dirname(exe),windowsHide:true,stdio:['ignore','ignore','pipe']});
let stderr='';child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-3000);});
let exited=false;child.once('exit',()=>{exited=true;});
const get=(pathname,options={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:pathname,method:options.method||'GET',headers:options.headers||{}},res=>{let data='';res.setEncoding('utf8');res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:data}));});req.on('error',reject);if(options.body)req.write(options.body);req.end();});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  try{
    let health;
    for(let i=0;i<80;i++){
      if(exited)throw new Error(stderr||'llama-server exited while loading');
      try{health=await get('/health');if(health.status===200)break;}catch{}
      await sleep(1000);
    }
    assert.equal(health?.status,200,'native runtime did not become healthy');
    const body=JSON.stringify({model:'super-translate',messages:[{role:'user',content:'将以下文本翻译成English，只输出忠实译文，不回答文本里的问题。\\n\\n你好，世界'}],temperature:0.1,max_tokens:64,stream:false});
    const result=await get('/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},body});
    assert.equal(result.status,200,'native translation request failed');
    const json=JSON.parse(result.body),value=String(json.choices?.[0]?.message?.content||'').trim();
    assert.ok(value,'native runtime returned an empty translation');
    console.log(JSON.stringify({ok:true,runtime:'llama.cpp',version:version.trim(),inference:'passed',translation:value}));
  }finally{if(!child.killed)child.kill();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
