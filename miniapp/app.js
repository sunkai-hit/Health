/**
 * S4 native WeChat Mini Program shell.
 * No wx.login, network, storage, genuine health data, or backend authorization
 * is enabled. All listed information is synthetic and bundled into the app.
 */
App({
  globalData: {
    launchMode:'synthetic-read-only',
    safeToStoreRealHealthData:false
  }
});
