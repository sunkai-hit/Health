# Health 微信小程序 S4 · 原生只读演示

## 当前阶段

**这是原生微信小程序框架，不是正式可登录/可存储医疗信息的版本。**

- 首批用户：中国大陆
- 客户端：微信小程序（非 WebView/PWA）
- 已提供：首页、虚构健康事件时间线（只读、打包在项目内）
- 未启用：真正微信登录、任何远程请求/数据库、健康事件录入、个人信息收集、文件上传、AI 或医疗建议

## 本地查看

1. 安装并打开[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 选择导入项目，目录定位到仓库中的 \`miniapp/\`。
3. \`project.config.json\` 使用 **\`touristappid\`（仅供游客/测试态调试）**，它不是正式 AppID，不能发布。若开发者工具提示需 AppID，可在本机开发者工具里选择合法测试号/自有小程序 AppID；**不要把真实 AppSecret 写入项目**。
4. 预览首页和只读虚构时间线。不要录入真实资料；当前没有真正的存储/登录/远程请求。
5. 当前自动化只验证静态工程结构、禁用网络/存储和后端微信身份适配器的模拟调用；尚未完成微信开发者工具或真机验收。

## 研发结构

\`\`\`text
miniapp/
  app.json            小程序页面路由和全局配置
  app.js              只读虚构演示初始化
  app.wxss            小程序基础视觉样式
  sitemap.json        演示内容不允许搜索收录
  project.config.json 游客测试标识，不可发布
  pages/index/        首页
  pages/timeline/     虚构健康事件时间线
\`\`\`

暂不加入输入表单，是为了防止还没有正式身份授权和安全数据管理时误把真实健康信息写入前端或开发环境。

## 未来登录流程（本轮不开放）

\`wx.login()\` 获取一次性 code → 小程序通过已备案 HTTPS API 域名发给后端 → 后端利用受控 AppID/AppSecret 交换 \`openid\` / \`session_key\` → 服务端将 \`appid+openid\` 映射为 Health 内部用户 → 建立可撤销 Health 会话 → 在用户获得医疗健康敏感信息单独同意后开放事件录入。

- \`session_key\` 与 AppSecret 严禁返回前端；\`openid\` 不当作直接可用于 API 的登录令牌。
- 首发不强制绑定手机号；后续业务如确有必要再设计独立用户授权。
- 选择中国大陆合规可用的云商及 API 域名、完成小程序/网站备案、平台隐私指引与敏感信息处理告知，都是上线前置条件。
- 旧 \`prototype/v0.1\` 是业务/UX 原型；S1～S3 Worker + D1 为**本地合成数据 API 研发基线**，不能直接部署为面向中国大陆真实用户的健康数据服务。
- 真实身份、会话、KMS 和正式后端需要单独实施并完整通过安全验收。

完整架构决策：[ADR-0001](../docs/ADR-0001-CHINA-WECHAT-LAUNCH.md)；[S4 边界](../docs/SPRINT-S4-WECHAT-SCOPE.md)。
