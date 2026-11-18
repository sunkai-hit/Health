/**
 * S5 CloudBase DEVELOPMENT connectivity probe ONLY.
 * AppID: wx027f1a9c66e3c01a
 * Environment ID was supplied by the project owner, but app association,
 * region, quotas and actual function deployment have NOT been verified.
 *
 * Startup may initialize the CloudBase SDK. The only permitted remote
 * operation is a user-triggered call to healthDevPing (fixed synthetic data).
 * NEVER enable real health record writes, user identity or cloud DB here.
 * CloudBase envId is a public routing identifier, not an AppSecret.
 */
module.exports = Object.freeze({
  enabled: true,
  envId: 'health-d2gxjb20h1d33fa91',
  purpose: 'synthetic-ping-only'
});
