/**
 * Health S5 synthetic-only CloudBase development shell.
 * The provided environment ID allows SDK initialization for a MANUAL ping.
 * No cloud request is made on startup; no real login or health data storage.
 */
const cloudSettings = require('./config/cloud-env');

App({
  onLaunch() {
    const validEnv = typeof cloudSettings.envId === 'string' &&
      /^[a-zA-Z0-9_-]{4,80}$/.test(cloudSettings.envId);
    if (cloudSettings.enabled !== true ||
        cloudSettings.purpose !== 'synthetic-ping-only' || !validEnv ||
        typeof wx === 'undefined' || !wx.cloud ||
        typeof wx.cloud.init !== 'function') return;

    // SDK initialization is not a CloudBase function call. The user must
    // manually trigger healthDevPing; handle missing app/environment binding.
    try {
      wx.cloud.init({env: cloudSettings.envId, traceUser: false});
      this.globalData.cloudDemoReady = true;
    } catch {
      this.globalData.cloudDemoReady = false;
    }
  },
  globalData: {
    launchMode:'synthetic-read-only',
    cloudDemoReady:false,
    safeToStoreRealHealthData:false
  }
});
