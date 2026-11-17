/** End-to-end synthetic API smoke tests against local-only Wrangler + D1.
 * Requires npm run dev:setup && npm run db:migrate:local.
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

const BASE='http://127.0.0.1:8787';
let output='';
const child=spawn('npm',['run','dev:api'],{
  stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32',env:process.env
});
for(const stream of [child.stdout,child.stderr]){
  stream.on('data',part=>{output+=part.toString();if(output.length>30000)output=output.slice(-30000);});
}
async function api(path,method='GET',value=undefined){
  const res=await fetch(BASE+path,{
    method,headers:value===undefined?{}:{'content-type':'application/json'},
    body:value===undefined?undefined:JSON.stringify(value)
  });
  return {status:res.status,data:await res.json()};
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
  assert.match(await ui.text(),/S1 核心研发联调/);ok('same-origin API integration page loads');

  console.log('PASS: '+count+' checks, local synthetic data only.');
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
