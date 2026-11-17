/**
 * S3 identity service contract only.
 *
 * No actual OIDC verifier, no callback route, no token exchange, no session
 * issuance and no user provisioning is implemented at this stage.
 * Production API must require an audited implementation of both ports below.
 */
export interface VerifiedExternalPrincipal {
  issuer: string;
  subject: string;
  audience: string;
  authenticatedAt: string | null;
}
export interface InternalPrincipal {
  userId: string;
  profileId: string;
  enabled: boolean;
}
export interface ExternalIdentityVerifier {
  /** Fails closed (returns null) for missing, untrusted, expired or wrong-audience credentials. */
  verify(request: Request):Promise<VerifiedExternalPrincipal|null>;
}
export interface IdentityLinkStore {
  /** Resolve a verified issuer + subject to a previously authorized internal account.
   * Never auto-create a patient profile merely on receipt of a token. */
  findAuthorizedAccount(issuer:string,subject:string):Promise<InternalPrincipal|null>;
}
export interface SessionRevocationStore {
  /** Confirm app session is active and has not been revoked; not implemented in S3. */
  isActive(sessionId:string):Promise<boolean>;
}
