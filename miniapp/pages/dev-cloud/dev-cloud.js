const cloudSettings = require('../../config/cloud-env');

Page({
  data: {
    available: false,
    loading: false,
    message: '未启用云开发测试环境，当前不会发起任何网络请求。'
  },
  onLoad() {
    const app = getApp();
    const ready = cloudSettings.enabled === true &&
      cloudSettings.purpose === 'synthetic-ping-only' &&
      typeof cloudSettings.envId === 'string' &&
      cloudSettings.envId.length > 0 &&
      app && app.globalData && app.globalData.cloudDemoReady === true;
    this.setData({
      available: !!ready,
      message: ready
        ? '仅用于连接性验证；不读取微信身份、不保存健康资料。'
        : '尚未配置或初始化云开发环境；当前不会请求云端。'
    });
  },
  async runPing() {
    if (!this.data.available || this.data.loading) return;
    this.setData({loading: true, message: '正在检查云函数联通性…'});
    try {
      const response = await wx.cloud.callFunction({
        name: 'healthDevPing',
        data: {}
      });
      const value = response && response.result;
      if (!value || value.ok !== true || value.mode !== 'synthetic-read-only' ||
        value.canStoreHealthData !== false || value.accountAuthenticated !== false) {
        throw new Error('UNEXPECTED_SYNTHETIC_PING_RESULT');
      }
      this.setData({message: '云开发测试函数已连接；尚未开启真实登录或健康数据存储。'});
    } catch {
      // Do not echo a platform error, identity, environment secrets or user data.
      this.setData({message: '连接未完成：请核对云开发环境关联、测试函数部署和权限设置。'});
    } finally {
      this.setData({loading: false});
    }
  }
});
