# Health S3｜身份接入架构与默认拒绝发布验收记录

- 日期：2026-11-17
- 分支：\`feature/mvp-s3-auth-boundary\`
- CI 完整运行：https://github.com/sunkai-hit/Health/actions/runs/44038625299
- 结论：**S3 本轮技术边界验收通过；未实现真实登录，不得处理真实健康数据。**
- 上游：S2 双虚构身份及浏览器竞态修复，已保留在各自 Draft PR 中。

## 一、实际执行的验收数据

| 作业 | 检查内容 | 实测结果 |
|---|---|---|
| auth-release-gate | OIDC 配置策略正负用例 | **16/16 通过** |
| auth-release-gate | 默认 Worker HTTP 全路径拒绝 | **7/7 通过** |
| auth-release-gate | TypeScript 与默认 Worker dry-run 打包 | **成功** |
| auth-release-gate | 默认发布 bundle 不含演示身份/密钥引用 | **成功** |
| mvp-api | S1/S2 实际本地 HTTP API 集成 | **27/27 通过** |
| sqlite-schema | SQLite 建表与约束测试 | **8/8 通过** |
| prototype-browser | 原七页原型 Chromium 桌面和模拟移动回归 | **18/18 通过** |
| mvp-browser | S2 本地双身份 Worker + D1 Chromium 回归 | **12/12 通过** |

**以可计数断言统计，共 88/88 项检查通过；五个 CI 作业全部 success。** 编译、数据库迁移和 bundle 安全扫描还属于额外成功的门槛，不能与 88 项断言重复累加。

## 二、本轮控制住的风险

### S3-R01：默认构建误发布虚构登录接口

此前默认 \`wrangler.jsonc\` 直接指向含 A/B 演示登录的本地 Worker。尽管使用了 \`DEMO_MODE=local\` 和本机限制，仍存在开发配置被误作发布构建的运维风险。

**解决：**
- 默认 \`wrangler.jsonc\` 改为指向 \`src/release-gate/index.ts\`，所有请求返回 503 \`RELEASE_BLOCKED\`。
- 默认配置没有 D1 绑定、没有公开路由，也没有 A/B 演示代码模块引用。
- S2 的原本演示服务仅在明确指定 \`wrangler.local.jsonc\` 后启动。
- \`npm run dev:api\` 和 \`npm run db:migrate:local\` 已显式使用本地配置，不改变 S1/S2 使用方式。
- CI 中启动默认 Worker 并使用真实 HTTP 检查七条路径，包括 \`POST /api/v1/dev/session\` 和 \`GET/POST /api/v1/events\`；全部 503，且不设置 Cookie 或返回身份凭据。
- Wrangler 默认生产 bundle dry-run 成功，构建产物没有 \`synthetic-owner-alice-v1\`、\`synthetic-owner-bob-v1\`、\`health-local-s2\`、\`DEMO_AUTH_SECRET_BASE64\` 等模拟身份标识。

**注意：** 这只是防误发布的纵深防护，不是对所有可能错误云配置的形式化安全证明；不允许任何人借此绕过正式部署审批。

### S3-R02：身份技术方向未约束，易产生不兼容和不安全实现

**解决：**
- 创建 \`src/auth/identity-contract.ts\`，明确正式验证身份与内部用户档案链接的接口。
- 创建 \`src/auth/oidc-policy.ts\`，将 OIDC 授权码、PKCE S256、HTTPS、非通配符回调、BFF 服务端会话作为配置策略。
- 16 项策略测试覆盖错误流程、错误 PKCE、HTTP 或 localhost 回调、通配符、空 audience、非法配置字段等。
- 没有擅自选择真实供应商，也没有把接口草案冒充已经可登录的系统。

## 三、严格未完成事项

- 真实用户身份证明与会话（注册/登录/登录回调、服务端 session、刷新/吊销、CSRF 保护）。
- 与实际 OIDC 服务的 OAuth State/Nonce/PKCE 事务管理，以及 JWT 签名、JWKS、发行方/接收对象和时钟核验。
- 手机号/邮箱/微信等登录入口、真实用户表及账号合并/迁移政策。
- 针对首批使用地区的数据驻留、敏感健康信息同意与撤回、KMS、加密密钥轮换、备份和永久删除。
- 跨用户真实账户权限验证、渗透测试、实机及医疗安全审核。
- 处方、实际用药、AI/OCR、报告/家庭档案的正式 API。

## 四、需求收敛

| 项目 | 分类 | 处理 |
|---|---|---|
| 默认发行配置指向演示 Worker | 本轮阻断 | **已修复，真实 HTTP + bundle 扫描通过** |
| OIDC 配置规范欠约束 | 本轮阻断 | **已实现策略校验与 16 项测试** |
| 正式登录供应商未选定 | 后续决策 | 等目标地区与首发登录方式明确后实施 |
| 会话安全、KMS、同意/删除 | 正式发布阻断 | 另立明确安全研发阶段，不能被本轮完成状态替代 |
| 处方/治疗、AI/OCR、报告 | 业务后续 | 保留原产品需求，未纳入 S3 |

**结论：本轮停止继续扩功能；保持 Draft PR，代码评审前不自动合并或部署。**

## 五、研发下一阶段建议

下一阶段只进入“真实身份接入的详细实施方案”阶段门：**先确定目标服务地区与首发登录方式**，随后选择合法可用的身份服务和部署环境，实现带有安全事务上下文的 OIDC/OAuth 回调和应用会话。用户未决定前，不写真实短信网关/登录供应商代码，也不开放数据入口。
