/** S2 LOCAL DEMO AUTH ONLY — not a production identity provider.
 * Two synthetic principals. Token issuance on localhost is intentionally
 * unrestricted to support negative authorization tests. Never deploy.
 */
export type Persona = 'alice' | 'bob';
export type DemoIdentity = {
  persona: Persona;
  ownerId: string;
  profileId: string;
  displayName: string;
};
export const DEMO_IDENTITIES: Record<Persona, DemoIdentity> = {
  alice: {
    persona: 'alice',
    ownerId: 'synthetic-owner-alice-v1',
    profileId: 'synthetic-profile-alice-v1',
    displayName: '虚构用户 A'
  },
  bob: {
    persona: 'bob',
    ownerId: 'synthetic-owner-bob-v1',
    profileId: 'synthetic-profile-bob-v1',
    displayName: '虚构用户 B'
  }
};
const ISSUER='health-local-s2';
const AUDIENCE='health-local-demo-api';
const TTL_SECONDS=15*60;
const encoder=new TextEncoder();
function binary(bytes:Uint8Array){
  let out='';
  for(let i=0;i<bytes.length;i++)out+=String.fromCharCode(bytes[i]);
  return out;
}
function base64Url(bytes:Uint8Array){
  return btoa(binary(bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeBase64Url(raw:string):Uint8Array{
  if(!/^[a-zA-Z0-9_-]{1,1500}$/.test(raw))throw Error('INVALID_TOKEN_ENCODING');
  const normalized=raw.replace(/-/g,'+').replace(/_/g,'/');
  const decoded=atob(normalized+'='.repeat((4-normalized.length%4)%4));
  return Uint8Array.from(decoded,c=>c.charCodeAt(0));
}
function keyBytes(value:string|undefined){
  if(!value)throw Error('DEMO_AUTH_KEY_NOT_CONFIGURED');
  const decoded=atob(value);
  const result=Uint8Array.from(decoded,c=>c.charCodeAt(0));
  if(result.length!==32)throw Error('DEMO_AUTH_KEY_INVALID');
  const stable=new Uint8Array(result.length);stable.set(result);
  return stable.buffer;
}
export async function importDemoAuthKey(value:string|undefined):Promise<CryptoKey>{
  return crypto.subtle.importKey('raw',keyBytes(value),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
function claimsJson(persona:Persona,issuedAt:number){
  return JSON.stringify({
    iss:ISSUER,
    aud:AUDIENCE,
    sub:persona,
    iat:issuedAt,
    exp:issuedAt+TTL_SECONDS,
    jti:crypto.randomUUID()
  });
}
export async function issueLocalToken(persona:Persona,key:CryptoKey,nowSec=Math.floor(Date.now()/1000)) {
  const payload=base64Url(encoder.encode(claimsJson(persona,nowSec)));
  const signed='s2d.'+payload;
  const signature=await crypto.subtle.sign('HMAC',key,encoder.encode(signed));
  return {access_token:signed+'.'+base64Url(new Uint8Array(signature)),expires_in:TTL_SECONDS,token_type:'Bearer'};
}
export async function verifyLocalToken(header:string|null,key:CryptoKey):Promise<DemoIdentity|null>{
  if(!header||header.length>2048||!/^Bearer [A-Za-z0-9._-]+$/.test(header))return null;
  const value=header.slice('Bearer '.length);
  const pieces=value.split('.');
  if(pieces.length!==3||pieces[0]!=='s2d')return null;
  try{
    const unsigned=pieces[0]+'.'+pieces[1];
    const sig=decodeBase64Url(pieces[2]);
    if(sig.byteLength!==32)return null;
    const stableSignature=new Uint8Array(sig.byteLength);
    stableSignature.set(sig);
    const checked=await crypto.subtle.verify('HMAC',key,stableSignature.buffer,encoder.encode(unsigned));
    if(!checked)return null;
    const claim=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decodeBase64Url(pieces[1]))) as Record<string,unknown>;
    const t=Math.floor(Date.now()/1000);
    if(claim.iss!==ISSUER||claim.aud!==AUDIENCE
       ||(claim.sub!=='alice'&&claim.sub!=='bob')
       ||!Number.isInteger(claim.iat)||!Number.isInteger(claim.exp)
       ||typeof claim.jti!=='string'||!claim.jti
       ||(claim.iat as number)>t+30||(claim.exp as number)<=t
       ||(claim.exp as number)-(claim.iat as number)!==TTL_SECONDS){
      return null;
    }
    return DEMO_IDENTITIES[claim.sub];
  }catch{
    return null;
  }
}
