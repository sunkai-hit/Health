/** End-to-end synthetic API smoke tests against local-only Wrangler + D1.
 * Requires npm run dev:setup && npm run db:migrate:local.
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const BASE='http://127.0.0.1:8787';
let output='';
let currentToken=null;
const child=spawn('npm',['run','dev:api'],{
  stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32',env:process.env
});
for(const stream of [child.stdout,child.stderr]){
  stream.on('data',part=>{output+=part.toString();if(output.length>30000)output=output.slice(-30000);});
}
async function api(path,method='GET',value=undefined,token=currentToken){
  const headers={};
  if(value!==undefined)headers['content-type']='application/json';
  if(token)headers.authorization='Bearer '+token;
  const res=await fetch(BASE+path,{
    method,headers,body:value===undefined?undefined:JSON.stringify(value)
  });
  return {status:res.status,data:await res.json()};
}
function fakeToken(overrides={}){
  // Offline negative test only; reads the random local signing key; never prints it.
  const config=readFileSync('.dev.vars','utf8');
  const secret=config.match(/^DEMO_AUTH_SECRET_BASE64=(.+)$/m)?.[1];
  assert.ok(secret,'missing demo auth secret');
  const now=Math.floor(Date.now()/1000);
  const claim={iss:'health-local-s2',aud:'health-local-demo-api',sub:'alice',
    iat:now-3600,exp:now-2700,jti:'synthetic-negative-check',...overrides};
  const payload=Buffer.from(JSON.stringify(claim)).toString('base64url');
  const unsigned='s2d.'+payload;
  const sig=createHmac('sha256',Buffer.from(secret,'base64')).update(unsigned).digest('base64url');
  return unsigned+'.'+sig;
}
async function waitForServer(){
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)throw new Error('Worker exited early: '+output.slice(-1200));
    try{
      const result=await api('/api/v1/health');
      if(result.status===200) return;
    }catch{}
    await delay(250);
  }
  throw new Error('Worker startup timed out: '+output.slice(-1200));
}
let count=0;
function ok(label){count++;console.log('✓ '+label);}
async function run(){
  await waitForServer();
  const health=await api('/api/v1/health');
  assert.equal(health.data.mode,'synthetic-local-demo');
  assert.equal(health.data.medical_analysis,false);ok('explicit local-only mode');
  const noToken=await api('/api/v1/events','GET',undefined,null);
  assert.equal(noToken.status,401);ok('health events reject missing bearer token');
  const badPersona=await api('/api/v1/dev/session','POST',{persona:'admin'},null);
  assert.equal(badPersona.status,422);ok('unknown demo identity rejected');
  const sessionA=await api('/api/v1/dev/session','POST',{persona:'alice'},null);
  const sessionB=await api('/api/v1/dev/session','POST',{persona:'bob'},null);
  assert.equal(sessionA.status,200);assert.equal(sessionB.status,200);
  assert.notEqual(sessionA.data.access_token,sessionB.data.access_token);
  assert.equal(sessionA.data.expires_in,900);
  const tokenA=sessionA.data.access_token,tokenB=sessionB.data.access_token;
  currentToken=tokenA;
  const identity=await api('/api/v1/me');
  assert.equal(identity.data.persona,'alice');ok('signed synthetic persona issued and verified');
  const tampered=tokenA.slice(0,-4)+'xxxx';
  const rejected=await api('/api/v1/events','GET',undefined,tampered);
  assert.equal(rejected.status,401);ok('tampered demo signature rejected');
  const expired=await api('/api/v1/events','GET',undefined,fakeToken());
  assert.equal(expired.status,401);ok('expired signed token rejected');
  const badAudience=await api('/api/v1/events','GET',undefined,fakeToken({iat:Math.floor(Date.now()/1000)-10,exp:Math.floor(Date.now()/1000)+890,aud:'other'}));
  assert.equal(badAudience.status,401);ok('incorrect audience rejected');

  const empty=await api('/api/v1/events','POST',{title:' ',onset_at:null});
  assert.equal(empty.status,422);ok('empty title rejected');

  const unsupported=await api('/api/v1/events','POST',{title:'虚构记录',owner_user_id:'another-user'});
  assert.equal(unsupported.status,422);ok('client-supplied ownership rejected');

  const unique='虚构S1腹部测试 '+Date.now();
  const created=await api('/api/v1/events','POST',{title:unique,onset_at:null,onset_precision:'unknown'});
  assert.equal(created.status,201);
  const id=created.data.item.id;
  assert.match(id,/^[0-9a-f-]{36}$/);
  assert.equal(created.data.item.onset_at,null);ok('create event with unknown onset');

  const list=await api('/api/v1/events');
  assert.equal(list.status,200);
  assert.ok(list.data.items.some(e=>e.id===id&&e.title===unique));ok('event persisted and listed from D1');
  const bList=await api('/api/v1/events','GET',undefined,tokenB);
  assert.equal(bList.status,200);
  assert.ok(!bList.data.items.some(e=>e.id===id));ok('user B cannot list user A events');
  const bDetail=await api('/api/v1/events/'+id,'GET',undefined,tokenB);
  assert.equal(bDetail.status,404);ok('user B cannot access user A event by ID');
  const bEntries=await api('/api/v1/events/'+id+'/entries','GET',undefined,tokenB);
  assert.equal(bEntries.status,404);ok('user B cannot read user A symptom list');
  const bEvent=await api('/api/v1/events','POST',{title:'虚构B的独立事件',onset_at:null,onset_precision:'unknown'},tokenB);
  assert.equal(bEvent.status,201);
  const bId=bEvent.data.item.id;
  const another=await api('/api/v1/events','GET',undefined,tokenA);
  assert.ok(!another.data.items.some(e=>e.id===bId));ok('user A cannot list user B events');

  const noSuch=await api('/api/v1/events/00000000-0000-4000-8000-000000000001');
  assert.equal(noSuch.status,404);ok('unknown event does not leak data');

  const input={
    kind:'symptom',
    symptoms:['虚构胀痛','恶心'],
    severity:null,
    narrative:'虚构用户症状记录，非真实健康信息',
    occurred_at:null,
    occurred_precision:'unknown',
    body_marks:[{view:'front',zone_code:'upper-abd',segment_code:'right-upper-abd'}],
    radiation:null
  };
  const symptom=await api('/api/v1/events/'+id+'/entries','POST',input);
  assert.equal(symptom.status,201);ok('symptom created independently of AI');
  const crossWrite=await api('/api/v1/events/'+id+'/entries','POST',input,tokenB);
  assert.equal(crossWrite.status,404);ok('user B cannot append to user A symptom timeline');
  const wrongProfile=await api('/api/v1/events/'+bId+'/entries','POST',input,tokenA);
  assert.equal(wrongProfile.status,404);ok('user A cannot append to user B timeline');

  const detail=await api('/api/v1/events/'+id);
  assert.equal(detail.status,200);
  assert.equal(detail.data.item.title,unique);
  assert.equal(detail.data.entries.length,1);
  assert.equal(detail.data.entries[0].severity,null);
  assert.equal(detail.data.entries[0].body_marks[0].segment_code,'right-upper-abd');
  assert.equal(detail.data.entries[0].source_type,'self_report');ok('D1 ciphertext successfully decrypted and timeline restored');

  const invalidSeverity=await api('/api/v1/events/'+id+'/entries','POST',{...input,severity:11});
  assert.equal(invalidSeverity.status,422);ok('out-of-range severity rejected');

  const invalidRegion=await api('/api/v1/events/'+id+'/entries','POST',{
    ...input,body_marks:[{view:'front',zone_code:'upper-abd',segment_code:'left-ear'}]
  });
  assert.equal(invalidRegion.status,422);ok('invalid body-map segment rejected');

  const unauthorizedSource=await api('/api/v1/events/'+id+'/entries','POST',{
    ...input,source_type:'verified_import'
  });
  assert.equal(unauthorizedSource.status,422);ok('client cannot fake verified medical source');

  const invalidRadiation=await api('/api/v1/events/'+id+'/entries','POST',{
    ...input,radiation:{from_index:0,to_index:0}
  });
  assert.equal(invalidRadiation.status,422);ok('invalid symptom radiation rejected');

  const after=await api('/api/v1/events/'+id+'/entries');
  assert.equal(after.status,200);
  assert.equal(after.data.items.length,1);ok('invalid requests did not create extra records');

  const unsupportedRoute=await api('/api/v1/events/'+id+'/orders');
  assert.equal(unsupportedRoute.status,404);ok('prescription API explicitly outside S1');

  const ui=await fetch(BASE+'/demo');
  assert.equal(ui.status,200);
  assert.match(await ui.text(),/S2 数据权限联调/);ok('same-origin synthetic persona switcher loads');

  console.log('PASS: '+count+' checks, two synthetic identities; no production authentication.');
}
try{
  await run();
}catch(e){
  console.error('FAIL: '+(e instanceof Error?e.message:String(e)));
  console.error('Wrangler log tail: '+output.slice(-2500));
  process.exitCode=1;
}finally{
  if(child.exitCode===null){
    try{
      if(process.platform==='win32')child.kill('SIGTERM');
      else process.kill(-child.pid,'SIGTERM');
    }catch{child.kill('SIGTERM');}
  }
}
