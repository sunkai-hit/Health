import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProductionOIDCPlan,REQUIRED_AUTH_SECURITY_GATES} from '../src/auth/oidc-policy';

const valid={
  providerType:'oidc',flow:'authorization_code',clientType:'confidential_bff',
  pkceMethod:'S256',issuer:'https://id.example.invalid/realms/demo',
  clientId:'health-web',redirectUri:'https://health.example.invalid/auth/callback',
  apiAudience:'health-api'
} as const;
function expectReject(name:string,changes:Record<string,unknown>,reason:string){
  test(name,()=>{
    const result=validateProductionOIDCPlan({...valid,...changes});
    assert.equal(result.ok,false);
    assert.ok(!result.ok&&result.issues.some(s=>s.includes(reason)),JSON.stringify(result));
  });
}
test('accepts a precisely defined HTTPS OIDC authorization-code BFF plan',()=>{
  const result=validateProductionOIDCPlan(valid);
  assert.equal(result.ok,true);
});
expectReject('rejects password/implicit-style login flow',{flow:'implicit'},'AUTHORIZATION_CODE_ONLY');
expectReject('rejects public browser token handling',{clientType:'public_spa'},'CONFIDENTIAL_BFF_ONLY');
expectReject('rejects missing PKCE S256',{pkceMethod:'plain'},'S256_ONLY');
expectReject('rejects HTTP identity issuer',{issuer:'http://id.example.invalid'},'REQUIRES_EXACT_HTTPS_URI');
expectReject('rejects HTTP callback',{redirectUri:'http://health.example.invalid/auth/callback'},'REQUIRES_EXACT_HTTPS_URI');
expectReject('rejects wildcard callback',{redirectUri:'https://*.example.invalid/callback'},'INVALID_URI');
expectReject('rejects localhost production callback',{redirectUri:'https://localhost/callback'},'NOT_PRODUCTION_HOST');
expectReject('rejects query on callback',{redirectUri:'https://health.example.invalid/auth/callback?next=/'},'REQUIRES_EXACT_HTTPS_URI');
expectReject('rejects fragment on callback',{redirectUri:'https://health.example.invalid/auth/callback#token'},'REQUIRES_EXACT_HTTPS_URI');
expectReject('rejects root callback',{redirectUri:'https://health.example.invalid/'},'CALLBACK_PATH_REQUIRED');
expectReject('rejects missing audience',{apiAudience:''},'API_AUDIENCE');
expectReject('rejects unsupported provider type',{providerType:'dev'},'MUST_USE_OIDC');
expectReject('rejects client-defined special override fields',{releaseAnyway:true},'UNSUPPORTED_FIELD');
test('rejects invalid plan shape',()=>{
  assert.equal(validateProductionOIDCPlan(null).ok,false);
  assert.equal(validateProductionOIDCPlan('not an object').ok,false);
});
test('auth release security gates remain explicit and nonempty',()=>{
  assert.ok(REQUIRED_AUTH_SECURITY_GATES.length>=9);
  assert.ok(REQUIRED_AUTH_SECURITY_GATES.includes('session_revocation_and_timeout'));
  assert.ok(REQUIRED_AUTH_SECURITY_GATES.includes('health_data_encryption_and_key_management'));
});
