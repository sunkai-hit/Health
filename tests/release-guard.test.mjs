/** Test the accidental-deploy default Worker with a REAL local HTTP server.
 * Never uses patient data, login credentials, internet or a real IdP.
 */
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
const repo=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const local=JSON.parse(readFileSync('wrangler.local.jsonc','utf8'));
assert.equal(repo.main,'src/release-gate/index.ts');
assert.equal(repo.workers_dev,false);
assert.ok(!repo.d1_databases,'default build must not bind the synthetic patient database');
assert.ok(!repo.routes,'default build must not declare routes');
assert.equal(local.main,'src/mvp/index.ts');
assert.ok(local.d1_databases?.length===1,'demo DB only exists in explicit local config');
const base='http://127.0.0.1:8790';
let log='';
const server=spawn('npm',['exec','--','wrangler','dev','--config','wrangler.jsonc','--local','--ip','127.0.0.1','--port','8790'],{
  stdio:['ignore','pipe','pipe'],
  detached:process.platform!=='win32'
});
for(const stream of [server.stdout,server.stderr]){
  stream.on('data',chunk=>{log+=chunk.toString();if(log.length>12000)log=log.slice(-12000);});
}
async function request(path,method='GET'){
  return fetch(base+path,{method,headers:method==='POST'?{'content-type':'application/json'}:{},
    body:method==='POST'?JSON.stringify({persona:'alice'}):undefined});
}
try{
  let ready=false;
  for(let i=0;i<120;i++){
    if(server.exitCode!==null)throw Error('release-gate worker exited '+log.slice(-1200));
    try{
      const res=await request('/api/v1/health');
      if(res.status===503){ready=true;break;}
    }catch{}
    await sleep(250);
  }
  assert.ok(ready,'release-gate failed to boot: '+log.slice(-1200));
  for(const [path,method] of [
    ['/','GET'],['/demo','GET'],['/api/v1/health','GET'],
    ['/api/v1/dev/session','POST'],['/api/v1/me','GET'],['/api/v1/events','GET'],
    ['/api/v1/events','POST']]){
    const res=await request(path,method);
    assert.equal(res.status,503,path+' must fail closed');
    assert.equal(res.headers.get('cache-control'),'no-store');
    assert.equal(res.headers.get('set-cookie'),null);
    const result=await res.json();
    assert.equal(result.error.code,'RELEASE_BLOCKED');
    assert.ok(!JSON.stringify(result).includes('access_token'));
    console.log('✓ release blocked: '+method+' '+path);
  }
  console.log('PASS: 7 release endpoints denied; no synthetic identities or health DB exposed by default');
}catch(err){
  console.error('FAIL: '+(err instanceof Error?err.message:String(err)));
  console.error('Worker log tail: '+log.slice(-2500));
  process.exitCode=1;
}finally{
  if(server.exitCode===null){
    try {
      if(process.platform==='win32')server.kill('SIGTERM');
      else process.kill(-server.pid,'SIGTERM');
    }catch{server.kill('SIGTERM');}
  }
}
