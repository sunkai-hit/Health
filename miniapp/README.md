# Health 微信小程序｜原生只读研发演示

## 项目配置

- 微信小程序 AppID：`wx027f1a9c66e3c01a`（由项目方提供，已写入 `project.config.json`）。
- AppID 是应用公开标识；**尚未核验该 AppID 的主体、管理权限、备案、类目或微信平台审核状态**。
- **不需要、也不允许把 AppSecret、session_key 或真实健康记录提交到仓库。**
- 本阶段工程仍只含虚构示例，不会因为配置 AppID 就开启真实微信登录。

## 在微信开发者工具中查看

1. 从 GitHub 获取 `feature/mvp-s4-wechat-foundation` 分支代码。
2. 打开微信开发者工具，选择“导入项目”，项目目录选择仓库中的 `miniapp/`。
3. 开发者工具应该识别 `project.config.json` 中的 AppID `wx027f1a9c66e3c01a`；使用有相应项目权限的微信账号登录。
4. 编译并查看首页、虚构事件时间线。如微信工具提示权限、主体或项目配置问题，需要在微信公众平台核对，不能通过代码推断账户状态。
5. 不尝试上传真实病历或发布为真实健康信息服务。**真实微信开发者工具编译、手机真机运行和平台审核尚未完成验收。**

## 当前实现范围

```text
miniapp/
  app.json               原生页面路由
  app.js                 虚构演示启动，不调用 wx.login
  app.wxss               基础 UI 样式
  project.config.json    已配置用户提供的 AppID；不含 Secret
  sitemap.json           演示页禁止搜索收录
  pages/index/           首页（只读）
  pages/timeline/        虚构健康事件时间线（只读）
```

目前客户端没有 `wx.login()`、`wx.request()`、真实资料录入、个人信息收集或本地持久化；这些约束由 `npm run test:wechat` 的自动化检查保护。

## 下一阶段的真实登录安全链路

未来经过审核后实现：`wx.login()` 获取一次性 `code` → 微信小程序通过已配置的 HTTPS 合法请求域名发给 Health 境内后端 → 后端使用保存在 Secret/KMS 中的 AppSecret 调用微信 `code2Session` → 将 `appid + openid` 映射为 Health 内部用户 → 签发可撤销的 Health 自有会话。

当前 `src/auth/wechat-code-exchange.ts` **仅实现服务端身份交换适配函数并通过模拟测试**，尚未提供公开 API，也未真实调用微信平台。不向小程序返回 AppSecret 或 `session_key`，不强制手机号绑定。

上线前仍须确认小程序主体与管理员权限、备案与类目资质、境内后端部署及域名、敏感个人信息告知与单独同意、KMS/加密及导出删除能力。

详见 [首发架构决策](../docs/ADR-0001-CHINA-WECHAT-LAUNCH.md)、[S4 范围](../docs/SPRINT-S4-WECHAT-SCOPE.md)、[S4 验收](../docs/SPRINT-S4-ACCEPTANCE.md)。
