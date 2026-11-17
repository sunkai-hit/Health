/**
 * WeChat Mini Program server-side login identity exchange adapter.
 *
 * IMPORTANT: S4 does not expose a login route and does not provision accounts
 * or issue real sessions. DO NOT invoke from a public route before S5 security
 * gates: account mapping, one-time code handling, session revocation, consent,
 * KMS, deployment location and full security review.
 *
 * AppSecret and session_key must NEVER be returned to the mini-program.
 * No raw upstream response or request URL is logged or exposed in errors.
 */
export type WechatMiniIdentity = Readonly<{
  provider:'wechat-mini';
  appId:string;
  openId:string;
  unionId:string|null;
}>;
export type HttpTransport = (input: RequestInfo | URL,init?:RequestInit)=>Promise<Response>;
export class WechatIdentityError extends Error {
  constructor(readonly code:
    'INVALID_CONFIG'|'INVALID_LOGIN_CODE'|'WECHAT_UNAVAILABLE'|
    'WECHAT_REJECTED_CODE'|'WECHAT_INVALID_RESPONSE') {
    super(code);
    this.name='WechatIdentityError';
  }
}
const codePattern=/^[A-Za-z0-9_-]{8,256}$/;
const appPattern=/^wx[a-fA-F0-9]{16}$/;
const secretPattern=/^[a-fA-F0-9]{32}$/;
const idPattern=/^[A-Za-z0-9_-]{1,128}$/;
export function validateWechatLoginCode(value:unknown):string {
  if(typeof value!=='string'||!codePattern.test(value))throw new WechatIdentityError('INVALID_LOGIN_CODE');
  return value;
}
export async function exchangeWechatLoginCode(
  config:Readonly<{appId:string;appSecret:string}>,
  code:unknown,
  transport:HttpTransport=fetch
):Promise<WechatMiniIdentity>{
  if(!config||!appPattern.test(config.appId)||!secretPattern.test(config.appSecret)){
    throw new WechatIdentityError('INVALID_CONFIG');
  }
  const jsCode=validateWechatLoginCode(code);
  const url=new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid',config.appId);
  url.searchParams.set('secret',config.appSecret);
  url.searchParams.set('js_code',jsCode);
  url.searchParams.set('grant_type','authorization_code');
  let response:Response;
  try{
    // WeChat requires a server-to-server exchange. Never send this URL
    // (which contains AppSecret) to clients, analytics, or application logs.
    response=await transport(url.toString(),{
      method:'GET',cache:'no-store',redirect:'error',
      signal:AbortSignal.timeout(5000)
    });
  }catch{
    throw new WechatIdentityError('WECHAT_UNAVAILABLE');
  }
  if(!response.ok)throw new WechatIdentityError('WECHAT_UNAVAILABLE');
  let payload:unknown;
  try{payload=await response.json();}
  catch{throw new WechatIdentityError('WECHAT_INVALID_RESPONSE');}
  if(!payload||typeof payload!=='object'||Array.isArray(payload)){
    throw new WechatIdentityError('WECHAT_INVALID_RESPONSE');
  }
  const r=payload as Record<string,unknown>;
  if(r.errcode!==undefined&&r.errcode!==0){
    throw new WechatIdentityError('WECHAT_REJECTED_CODE');
  }
  if(typeof r.openid!=='string'||!idPattern.test(r.openid)){
    throw new WechatIdentityError('WECHAT_INVALID_RESPONSE');
  }
  if(r.unionid!==undefined&&r.unionid!==null &&
    (typeof r.unionid!=='string'||!idPattern.test(r.unionid))){
    throw new WechatIdentityError('WECHAT_INVALID_RESPONSE');
  }
  // session_key is intentionally NOT returned or persisted by this adapter.
  return Object.freeze({
    provider:'wechat-mini',
    appId:config.appId,
    openId:r.openid,
    unionId:typeof r.unionid==='string'?r.unionid:null
  });
}
