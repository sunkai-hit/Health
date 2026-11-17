/** Provider-neutral OIDC configuration policy — no login flow is enabled.
 * References: RFC 9700 OAuth Security BCP, OIDC Core.
 * Security review is still required before implementing any real provider.
 */
export type OIDCPlan = {
  providerType: 'oidc';
  flow: 'authorization_code';
  clientType: 'confidential_bff';
  pkceMethod: 'S256';
  issuer: string;
  clientId: string;
  redirectUri: string;
  apiAudience: string;
};
export type PolicyResult = {ok: true; plan: OIDCPlan} | {ok:false;issues:string[]};
function validHttps(raw:unknown,name:string,issues:string[],allowPath=true):URL|null {
  if(typeof raw!=='string'||raw.length>1024||raw.trim()!==raw||raw.includes('*')){
    issues.push(name+':INVALID_URI');return null;
  }
  try {
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port&&u.port!=='443'||
      !u.hostname||!allowPath&&u.pathname!=='/'){
      issues.push(name+':REQUIRES_EXACT_HTTPS_URI');return null;
    }
    if(['localhost','127.0.0.1','::1'].includes(u.hostname)||
       u.hostname.endsWith('.localhost')||u.hostname.endsWith('.local')||u.hostname.includes('%')){
      issues.push(name+':NOT_PRODUCTION_HOST');return null;
    }
    return u;
  }catch{
    issues.push(name+':INVALID_URI');return null;
  }
}
function nonblank(raw:unknown,name:string,issues:string[],limit=256):raw is string {
  if(typeof raw!=='string'||!raw.trim()||raw!==raw.trim()||raw.length>limit||/\s/.test(raw)){
    issues.push(name+':REQUIRED');return false;
  }
  return true;
}
export function validateProductionOIDCPlan(raw:unknown):PolicyResult {
  const issues:string[]=[];
  if(!raw||typeof raw!=='object'||Array.isArray(raw)){
    return {ok:false,issues:['PLAN:INVALID_OBJECT']};
  }
  const r=raw as Record<string,unknown>;
  const fields=['providerType','flow','clientType','pkceMethod','issuer','clientId','redirectUri','apiAudience'];
  for(const key of Object.keys(r)){
    if(!fields.includes(key))issues.push('UNSUPPORTED_FIELD:'+key);
  }
  if(r.providerType!=='oidc')issues.push('PROVIDER:MUST_USE_OIDC');
  if(r.flow!=='authorization_code')issues.push('FLOW:AUTHORIZATION_CODE_ONLY');
  if(r.clientType!=='confidential_bff')issues.push('CLIENT:CONFIDENTIAL_BFF_ONLY');
  if(r.pkceMethod!=='S256')issues.push('PKCE:S256_ONLY');
  const issuer=validHttps(r.issuer,'ISSUER',issues);
  const redirect=validHttps(r.redirectUri,'REDIRECT',issues);
  nonblank(r.clientId,'CLIENT_ID',issues);
  nonblank(r.apiAudience,'API_AUDIENCE',issues);
  // Exact redirect registration and issuer matching must be performed by the
  // chosen provider implementation; this policy checks only configuration syntax.
  if(issuer&&redirect && issuer.origin===redirect.origin){
    // Same origin is allowed for self-hosted OIDC; do not require a different IdP.
  }
  if(redirect&&redirect.pathname==='/'){
    issues.push('REDIRECT:EXPLICIT_CALLBACK_PATH_REQUIRED');
  }
  return issues.length ? {ok:false,issues} : {ok:true,plan:r as OIDCPlan};
}
export const REQUIRED_AUTH_SECURITY_GATES=[
  'target_market_and_data_residency',
  'identity_provider_contract_and_jwks_validation',
  'authorization_code_pkce_state_nonce',
  'secure_http_only_bff_session_and_csrf',
  'account_linking_no_auto_provisioning',
  'session_revocation_and_timeout',
  'health_data_encryption_and_key_management',
  'sensitive_information_consent',
  'account_export_deletion_and_audit',
  'cross_user_security_and_medical_release_review'
] as const;
