# Health S2｜本地虚构身份与权限联调

**仅用于虚构测试数据。不得公开部署，也不得输入真实姓名、症状、病历、处方或其他个人健康信息。**

S2 在已通过测试的 S1 “事件 → 症状 → 时间线”之上增加**签名演示令牌 + 双虚构用户 A/B + 资源归属隔离**。它不是正式账号或安全登录系统。

## 运行

需要 Node.js 22、npm，首次运行下载依赖：

\`\`\`bash
npm install
npm run dev:setup
npm run db:migrate:local
npm run dev:api
\`\`\`

浏览器访问 \`http://127.0.0.1:8787/demo\`，可在虚构用户 A/B 之间切换、分别创建事件/症状，并验证看不到对方的数据。

\`dev:setup\` 在 git 忽略的 \`.dev.vars\` 创建两种独立随机密钥：\`DEMO_KEY_BASE64\` 用于 S1 数据密文，\`DEMO_AUTH_SECRET_BASE64\` 用于 S2 演示令牌签名。如果已有 S1 \`.dev.vars\`，只补充缺失的演示签名密钥，不覆盖原加密密钥。

注意：先前 S1 固定虚构档案的老演示事件不会自动归入 A/B。旧数据仍留在本地数据库，S2 只读取 A/B 新建的事件；如果只需要纯虚构测试，可自行重置 \`.wrangler/\`。

## 实现的 API

- \`GET /api/v1/health\`：本机演示状态（无需令牌）
- \`POST /api/v1/dev/session\`：**仅本机**申请 A/B 虚构身份的 15 分钟 HMAC 签名令牌（任何本地演示者都可申请，非身份认证）
- \`GET /api/v1/me\`：返回已校验的虚构主体（需 Bearer）
- \`GET/POST /api/v1/events\`：当前虚构主体的事件
- \`GET /api/v1/events/:id\`：当前虚构主体的事件及时间线
- \`GET/POST /api/v1/events/:id/entries\`：当前虚构主体的症状

除健康检查/演示令牌申请外，所有 API 均要求 \`Authorization: Bearer <token>\`。令牌验证包括签名、发行方、使用对象、主体白名单、有效期限。事件列表、详情及症状读取与创建由服务端验证事件归属；即使知道其他用户事件 ID，也只返回 404，不泄漏是否存在。

## 自动化测试

\`\`\`bash
npm run check:types
npm run test:api
npm run test:db
npm run test:prototype
\`\`\`

\`test:api\` 会启动本地 Worker 并进行真实 HTTP 断言，覆盖令牌缺失/篡改/过期、错误用途、A/B 双向列表及事件读取隔离、跨用户症状写入拒绝、S1 数据功能与错误输入回归。

## 边界

- 双虚构身份不是真实用户注册/登录。本地用户可主动申请任一个演示令牌；不能作为患者身份保障。
- 令牌仅在演示页 JavaScript 变量中持有，不写入浏览器长期存储；也没有生产会话吊销机制。
- 当前使用同一个本地演示数据加密主密钥，无生产 KMS、密钥轮换、备份、访问审计复核和真实账户绑定。
- 运行门槛 \`DEMO_MODE=local\`、仅本地监听、无公开路由，都不是可替代正式认证/部署审查的安全体系。
- 本轮不开发处方、用药、治疗、AI、OCR、PDF、数据同步等 API。

详细范围见 [S2 范围文档](../../docs/SPRINT-S2-BOUNDARY.md)。已确认但未进入开发的产品需求仍在上游需求 PR 中保留。


## 浏览器联调验收（新增 S2 QA）

在运行 \`npm install\`、\`npm run dev:setup\`、\`npm run db:migrate:local\` 之后：

\`\`\`bash
npm run test:dev-ui
\`\`\`

此命令用专用 \`playwright.mvp.config.mjs\` 自动启动本地 Worker，真实连接本地 D1，按桌面与 390px 移动模拟视口分别运行六类场景，检查 A/B 切换、事件/症状归属、刷新、输入显示及异步切换竞态。无需预先运行 \`npm run dev:api\`；不要把测试服务暴露到局域网或公网上。

最新已通过 [CI 44025858347](https://github.com/sunkai-hit/Health/actions/runs/44025858347)，详细见 [问题收敛记录](../../docs/SPRINT-S2-BROWSER-QA-RESULTS.md)。仍非真实设备、真实身份认证或生产数据安全验收。


## S3 安全调整：默认 Worker 不再是演示环境

- 默认 \`wrangler.jsonc\` 只指向阻断入口：所有请求返回 503，不绑定 D1、不提供 A/B 演示 API。
- 虚构用户 A/B 的原本联调服务保存在显式的 \`wrangler.local.jsonc\`；上述 \`npm run dev:api\`、\`npm run db:migrate:local\` 命令已经自动使用该本地配置。
- 可以运行 \`npm run test:release-guard\` 检查默认 Worker 实际 HTTP 503，运行 \`npm run test:auth-policy\` 检查未来 OIDC 配置负面案例。
- **默认阻断入口不是可上线的真实 Health 服务**；不能因构建和测试通过而存储患者数据或运行 \`wrangler deploy\`。

[S3 身份与发布边界](../../docs/SPRINT-S3-AUTH-BOUNDARY.md) · [S3 验收报告](../../docs/SPRINT-S3-ACCEPTANCE.md)
