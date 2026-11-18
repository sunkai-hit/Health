/**
 * S5 synthetic-only CloudBase connectivity probe.
 * No database, no file storage, no identity disclosure, no real health records.
 * Platform may run this after an explicit manual upload to a TEST environment.
 */
exports.main = async () => Object.freeze({
  ok: true,
  mode: 'synthetic-read-only',
  function: 'healthDevPing',
  canStoreHealthData: false,
  accountAuthenticated: false
});
