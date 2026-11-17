/**
 * Health S5 native CloudBase development shell.
 * The checked-in CloudBase config is DISABLED and has no environment ID:
 * no cloud network call, login, database or health information collection.
 */
const cloudSettings = require('./config/cloud-env');

App({
  onLaunch() {
    const validEnv = typeof cloudSettings.envId === 'string' &&
      /^[a-zA-Z0-9_-]{4,80}$/.test(cloudSettings.envId);
    if (cloudSettings.enabled !== true || !validEnv ||
        typeof wx === 'undefined' || !wx.cloud ||
        typeof wx.cloud.init !== 'function') return;

    // Only a disposable test environment manually bound to the app's AppID.
    wx.cloud.init({env: cloudSettings.envId, traceUser: false});
    this.globalData.cloudDemoReady = true;
  },
  globalData: {
    launchMode:'synthetic-read-only',
    cloudDemoReady:false,
    safeToStoreRealHealthData:false
  }
});
