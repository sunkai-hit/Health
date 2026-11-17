# 微信云开发测试环境：无需自购服务器和域名

当前 AppID：\`wx027f1a9c66e3c01a\`。**先创建测试环境，不使用真实健康数据。**

## 你需要在微信开发者工具里完成的步骤

1. 使用有该 AppID 开发权限的微信账号登录[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)，导入仓库 \`miniapp/\` 目录。
2. 在开发者工具中打开 **「云开发」**；如果尚未开通，按平台页面创建测试环境。建议选择中国大陆适用地域，确认账单/配额，避免自动产生不预期费用。
3. 检查云环境是否与小程序 AppID \`wx027f1a9c66e3c01a\` 正确绑定。也可在 CloudBase 环境配置的安全配置/小程序关联中查看。**测试环境必须是你具有权限的账号创建的环境**。
4. 把测试环境 ID 填到 \`miniapp/config/cloud-env.js\` 的 \`envId\` 中，将 \`enabled\` 改为 \`true\`。请仅在本地修改该文件，不要把误用的配置作为正式发布。
5. 小程序工程里 \`cloudfunctions/\` 目录包含 \`healthDevPing\`。在微信开发者工具里对这个云函数执行「上传并部署」；如要求安装依赖，按工具提示处理（本函数没有第三方依赖）。
6. 在开发者工具中重新编译小程序 → 首页 → 「云开发连接测试」→ 点击「验证云函数连接」。**只应看到固定的连接成功信息**，没有 OpenID、登录 Token、健康事件、文件或个人资料。
7. 完成后建议恢复 \`cloud-env.js\` 的默认关闭状态，保留测试环境的管理信息，不向公开仓库提交账号密钥、访问凭据或真实病历。

### 常见问题

- “非法 env / 环境不存在”：多见于环境 ID 填错、AppID 未关联环境、账号/云资源所属关系不一致。
- “找不到云函数”：检查 \`project.config.json\` 的 \`cloudfunctionRoot\`、是否上传 \`healthDevPing\`、是否部署到正确环境。
- 点击无响应：检查 \`enabled\`、\`envId\` 和微信云能力初始化。默认配置关闭是**预期的安全行为**，不是故障。
- 不需要先买自有域名或服务器来测试云函数；但是**小程序备案、平台资质、个人信息保护和云服务收费/配额仍需要分别处理**。

### 后续正式研发阶段门

云开发测试成功后，仍不得立即开启健康记录存储。正式健康信息为敏感个人信息，必须先确认适用处理的法律基础、告知及单独同意、云资源地域与日志/备份、云函数权限、逐用户授权、加密/KMS、数据导出和删除。

此外，腾讯云官方提示混合入口云函数在实例复用时可能导致 \`getWXContext\` 的身份混淆。**正式用户身份只能在服务端采用经过评审且与调用来源相匹配的安全解析方式**，不能直接信任小程序传入的 \`openid\` 参数。

本期 \`healthDevPing\` 不访问任何用户身份或数据库，也不调用微信外部服务。

参考：
- https://docs.cloudbase.net/recipes/add-cloud-function-wechat-miniprogram
- https://docs.cloudbase.net/quick-start/create-env
- https://docs.cloudbase.net/cloud-function/instance
