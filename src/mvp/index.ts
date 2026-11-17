import { parseEvent, parseSymptom, InputError, type EventInput, type SymptomInput } from './domain';
import { importKey, encrypt, decrypt } from './crypto';
import { demoHTML } from './demo-ui';

interface Env {
  DB: D1Database;
  DEMO_MODE?: string;
  DEMO_KEY_BASE64?: string;
}
const OWNER = 'synthetic-owner-v1';
const PROFILE = 'synthetic-profile-v1';
const MAX_BODY_BYTES = 16_000;
const HEADERS = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store','x-content-type-options':'nosniff' };
const now = () => new Date().toISOString();
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:HEADERS});}
function failure(code:string,message:string,status:number){return json({error:{code,message}},status);}
async function localKey(request:Request,env:Env) {
  const host=new URL(request.url).hostname;
  // A local demo gate, NOT identity authentication.
  if(env.DEMO_MODE!=='local' || !['localhost','127.0.0.1','[::1]'].includes(host))return null;
  return importKey(env.DEMO_KEY_BASE64);
}
async function ensureDemo(db:D1Database){
  const time=now();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO user_accounts(id,auth_subject,created_at,updated_at) VALUES(?,?,?,?)').bind(OWNER,'synthetic|local-demo',time,time),
    db.prepare('INSERT OR IGNORE INTO health_profiles(id,owner_user_id,created_at,updated_at) VALUES(?,?,?,?)').bind(PROFILE,OWNER,time,time)
  ]);
}
async function readJson(req:Request):Promise<unknown>{
  if(!/^application\/json\b/i.test(req.headers.get('content-type')||''))throw new InputError('UNSUPPORTED_CONTENT_TYPE','只接受 JSON');
  if(Number(req.headers.get('content-length')||0)>MAX_BODY_BYTES)throw new InputError('TOO_LARGE','数据过长');
  const value=await req.text();
  if(value.length>MAX_BODY_BYTES)throw new InputError('TOO_LARGE','数据过长');
  try{return JSON.parse(value);}catch{throw new InputError('INVALID_JSON','请求不是有效 JSON');}
}
type EventRow={
  id:string;status:string;title_ciphertext:unknown;onset_at:string|null;
  onset_precision:string;created_at:string;updated_at:string;version:number;
};
async function getEvent(db:D1Database,id:string):Promise<EventRow|null>{
  if(!/^[0-9a-f-]{36}$/.test(id))return null;
  return db.prepare('SELECT id,status,title_ciphertext,onset_at,onset_precision,created_at,updated_at,version FROM health_events WHERE id=? AND profile_id=?')
    .bind(id,PROFILE).first<EventRow>();
}
async function visibleEvent(key:CryptoKey,row:EventRow) {
  return {id:row.id,title:await decrypt<string>(key,'event-title:'+row.id,row.title_ciphertext),
    status:row.status,onset_at:row.onset_at,onset_precision:row.onset_precision,
    created_at:row.created_at,updated_at:row.updated_at,version:row.version};
}
async function allEvents(db:D1Database,key:CryptoKey){
  const result=await db.prepare('SELECT id,status,title_ciphertext,onset_at,onset_precision,created_at,updated_at,version FROM health_events WHERE profile_id=? ORDER BY created_at DESC LIMIT 100').bind(PROFILE).all<EventRow>();
  return json({items:await Promise.all((result.results||[]).map(row=>visibleEvent(key,row)))});
}
async function makeEvent(db:D1Database,key:CryptoKey,input:EventInput){
  const id=crypto.randomUUID(),time=now();
  const encrypted=await encrypt(key,'event-title:'+id,input.title);
  await db.batch([
    db.prepare('INSERT INTO health_events(id,profile_id,status,title_ciphertext,onset_at,onset_precision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
      .bind(id,PROFILE,'open',encrypted,input.onset_at,input.onset_precision,time,time),
    db.prepare('INSERT INTO record_revisions(id,owner_user_id,resource_type,resource_id,action,new_version,changed_at) VALUES(?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),OWNER,'health_event',id,'create',1,time),
    db.prepare('INSERT INTO audit_events(id,actor_user_id,action_code,resource_type,resource_id,result_code,occurred_at) VALUES(?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),OWNER,'CREATE','health_event',id,'OK',time)
  ]);
  return json({item:{id,title:input.title,status:'open',onset_at:input.onset_at,
    onset_precision:input.onset_precision,created_at:time,updated_at:time,version:1}},201);
}
type EntryRow={id:string;event_id:string;entry_type:string;occurred_at:string|null;occurred_precision:string;payload_ciphertext:unknown;source_type:string;created_at:string;};
type MarkRow={id:string;entry_id:string;view:string;map_version:string;mark_ciphertext:unknown;};
async function allEntries(db:D1Database,key:CryptoKey,eventId:string){
  const [e,m]=await db.batch([
    db.prepare('SELECT id,event_id,entry_type,occurred_at,occurred_precision,payload_ciphertext,source_type,created_at FROM event_entries WHERE event_id=? AND deleted_at IS NULL ORDER BY occurred_at ASC,created_at ASC').bind(eventId),
    db.prepare('SELECT b.id,b.entry_id,b.view,b.map_version,b.mark_ciphertext FROM body_marks b JOIN event_entries e ON e.id=b.entry_id WHERE e.event_id=? AND e.deleted_at IS NULL ORDER BY b.created_at,b.id').bind(eventId)
  ]);
  const marks=(m.results||[]) as MarkRow[];
  const markMap=new Map<string,Array<{view:string;zone_code:string;segment_code:string|null}>>();
  for(const mark of marks){
    const data=await decrypt<{zone_code:string;segment_code:string|null}>(key,'body-mark:'+mark.id,mark.mark_ciphertext);
    if(!markMap.has(mark.entry_id))markMap.set(mark.entry_id,[]);
    markMap.get(mark.entry_id)!.push({view:mark.view,...data});
  }
  return Promise.all(((e.results||[]) as EntryRow[]).map(async row=>{
    const value=await decrypt<Omit<SymptomInput,'body_marks'>>(key,'symptom:'+row.id,row.payload_ciphertext);
    return {id:row.id,kind:row.entry_type,source_type:row.source_type,
      created_at:row.created_at,...value,body_marks:markMap.get(row.id)||[]};
  }));
}
async function makeSymptom(db:D1Database,key:CryptoKey,eventId:string,input:SymptomInput){
  const id=crypto.randomUUID(),time=now();
  const {body_marks,...payload}=input;
  const encrypted=await encrypt(key,'symptom:'+id,payload);
  const stmts=[
    db.prepare('INSERT INTO event_entries(id,event_id,entry_type,occurred_at,occurred_precision,source_type,payload_ciphertext,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(id,eventId,'symptom',input.occurred_at,input.occurred_precision,'self_report',encrypted,time,time)
  ];
  for(const mark of body_marks){
    const markId=crypto.randomUUID();
    const blob=await encrypt(key,'body-mark:'+markId,{zone_code:mark.zone_code,segment_code:mark.segment_code});
    stmts.push(db.prepare('INSERT INTO body_marks(id,entry_id,map_version,view,mark_ciphertext,created_at) VALUES(?,?,?,?,?,?)')
      .bind(markId,id,'v1',mark.view,blob,time));
  }
  stmts.push(db.prepare('INSERT INTO record_revisions(id,owner_user_id,resource_type,resource_id,action,new_version,changed_at) VALUES(?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),OWNER,'event_entry',id,'create',1,time));
  stmts.push(db.prepare('INSERT INTO audit_events(id,actor_user_id,action_code,resource_type,resource_id,result_code,occurred_at) VALUES(?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),OWNER,'CREATE','event_entry',id,'OK',time));
  await db.batch(stmts);
  return json({item:{id,event_id:eventId,kind:'symptom',...input,source_type:'self_report',created_at:time}},201);
}
const worker:ExportedHandler<Env>={
  async fetch(request,env){
    try{
      const key=await localKey(request,env);
      if(!key)return failure('LOCAL_DEMO_ONLY','研发 API 仅允许本地演示环境；未开放生产访问',503);
      const path=new URL(request.url).pathname;
      if(path==='/'||path==='/demo'){
        if(request.method!=='GET')return failure('METHOD_NOT_ALLOWED','不支持的方法',405);
        return new Response(demoHTML,{headers:{
          'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',
          'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'"
        }});
      }
      if(path==='/api/v1/health' && request.method==='GET')return json({status:'ok',mode:'synthetic-local-demo',medical_analysis:false});
      if(!path.startsWith('/api/v1/'))return failure('NOT_FOUND','路径不存在',404);
      await ensureDemo(env.DB);
      if(path==='/api/v1/events'){
        if(request.method==='GET')return allEvents(env.DB,key);
        if(request.method==='POST')return makeEvent(env.DB,key,parseEvent(await readJson(request)));
        return failure('METHOD_NOT_ALLOWED','不支持的方法',405);
      }
      const match=path.match(/^\/api\/v1\/events\/([0-9a-f-]{36})(?:\/(entries))?$/);
      if(!match)return failure('NOT_FOUND','资源不存在',404);
      const record=await getEvent(env.DB,match[1]);
      if(!record)return failure('NOT_FOUND','资源不存在',404);
      if(!match[2]&&request.method==='GET')return json({item:await visibleEvent(key,record),entries:await allEntries(env.DB,key,match[1])});
      if(match[2]==='entries'&&request.method==='GET')return json({items:await allEntries(env.DB,key,match[1])});
      if(match[2]==='entries'&&request.method==='POST')return makeSymptom(env.DB,key,match[1],parseSymptom(await readJson(request)));
      return failure('METHOD_NOT_ALLOWED','不支持的方法',405);
    }catch(error){
      if(error instanceof InputError)return failure(error.code,error.message,error.status);
      // Do not log health record content, secrets, or ciphertext.
      return failure('INTERNAL_ERROR','服务处理失败；检查本地数据库迁移与演示密钥',500);
    }
  }
};
export default worker;
