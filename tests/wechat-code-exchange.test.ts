import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exchangeWechatLoginCode,validateWechatLoginCode,WechatIdentityError,type HttpTransport
} from '../src/auth/wechat-code-exchange';

const cfg=Object.freeze({appId:'wx1234567890abcdef',appSecret:'a'.repeat(32)});
const validCode='04256syntheticLoginCodeXYZ';
const mock=(value:unknown,status=200):HttpTransport=>async()=>new Response(
  typeof value==='string'?value:JSON.stringify(value),
  {status,headers:{'content-type':'application/json'}}
);
function rejection(label:string,run:()=>Promise<unknown>,code:string){
  test(label,async()=>{
    await assert.rejects(run(),(error:unknown)=>
      error instanceof WechatIdentityError&&error.code===code
    );
  });
}
test('valid code allows only conservative single-use token format',()=>{
  assert.equal(validateWechatLoginCode(validCode),validCode);
  assert.throws(()=>validateWechatLoginCode('../../secret'),WechatIdentityError);
  assert.throws(()=>validateWechatLoginCode(' '),WechatIdentityError);
  assert.throws(()=>validateWechatLoginCode('abcd'),WechatIdentityError);
});
test('server exchange targets WeChat only; returns identity without secrets or session_key',async()=>{
  let calls=0;
  const transport:HttpTransport=async(input,init)=>{
    calls++;
    const u=new URL(String(input));
    assert.equal(u.origin,'https://api.weixin.qq.com');
    assert.equal(u.pathname,'/sns/jscode2session');
    assert.equal(u.searchParams.get('appid'),cfg.appId);
    assert.equal(u.searchParams.get('secret'),cfg.appSecret);
    assert.equal(u.searchParams.get('js_code'),validCode);
    assert.equal(u.searchParams.get('grant_type'),'authorization_code');
    assert.equal(init?.method,'GET');
    assert.equal(init?.cache,'no-store');
    assert.equal(init?.redirect,'error');
    return new Response(JSON.stringify({
      openid:'synthetic_open_id_01',
      unionid:'synthetic_union_id_01',
      session_key:'server_secret_wechat_session_key'
    }),{status:200,headers:{'content-type':'application/json'}});
  };
  const identity=await exchangeWechatLoginCode(cfg,validCode,transport);
  assert.equal(calls,1);
  assert.deepEqual(identity,{
    provider:'wechat-mini',appId:cfg.appId,
    openId:'synthetic_open_id_01',unionId:'synthetic_union_id_01'
  });
  const output=JSON.stringify(identity);
  assert.ok(!output.includes(cfg.appSecret));
  assert.ok(!output.includes('server_secret_wechat_session_key'));
});
test('unionid is optional; do not use it as the first-launch primary account key',async()=>{
  const result=await exchangeWechatLoginCode(cfg,validCode,mock({
    openid:'synthetic_open_id_02',session_key:'never_forward'
  }));
  assert.equal(result.unionId,null);
  assert.equal(result.openId,'synthetic_open_id_02');
});
rejection('invalid client code never reaches WeChat',()=>{
  let called=false;
  const fake:HttpTransport=async()=>{called=true;return new Response('{}');};
  return exchangeWechatLoginCode(cfg,'not code',fake).finally(()=>assert.equal(called,false));
},'INVALID_LOGIN_CODE');
rejection('missing server credential is rejected without calling network',()=>exchangeWechatLoginCode({
  appId:cfg.appId,appSecret:''
},validCode,mock({openid:'synthetic'})),'INVALID_CONFIG');
rejection('bad AppID is rejected',()=>exchangeWechatLoginCode({
  appId:'unregistered',appSecret:cfg.appSecret
},validCode,mock({openid:'synthetic'})),'INVALID_CONFIG');
rejection('WeChat single-use/invalid code errcode is a generic rejected response',()=>{
  return exchangeWechatLoginCode(cfg,validCode,mock({errcode:40029,errmsg:'invalid code'}));
},'WECHAT_REJECTED_CODE');
rejection('WeChat HTTP non-200 is unavailable',()=>exchangeWechatLoginCode(cfg,validCode,mock({},503)),'WECHAT_UNAVAILABLE');
rejection('WeChat network failure hides raw exception',()=>exchangeWechatLoginCode(cfg,validCode,async()=>{throw Error('raw network URL contains secrets');}),'WECHAT_UNAVAILABLE');
rejection('WeChat malformed JSON is not accepted',()=>exchangeWechatLoginCode(cfg,validCode,mock('this is not json')),'WECHAT_INVALID_RESPONSE');
rejection('WeChat response must contain OpenID',()=>exchangeWechatLoginCode(cfg,validCode,mock({session_key:'secret'})),'WECHAT_INVALID_RESPONSE');
rejection('WeChat response rejects malformed OpenID',()=>exchangeWechatLoginCode(cfg,validCode,mock({openid:'<script>not-an-id</script>'})),'WECHAT_INVALID_RESPONSE');
rejection('WeChat response rejects malformed UnionID',()=>exchangeWechatLoginCode(cfg,validCode,mock({openid:'valid-id',unionid:{bad:'shape'}})),'WECHAT_INVALID_RESPONSE');
rejection('WeChat success is not inferred from unexpected numeric errcode',()=>exchangeWechatLoginCode(cfg,validCode,mock({errcode:402,openid:'valid-id'})),'WECHAT_REJECTED_CODE');
