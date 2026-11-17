# Health Sprint S3｜正式身份接入边界与默认禁止发布（研发评审）

日期：2026-11-17
状态：**身份架构/构建安全底座，非正式登录上线**
分支：\`feature/mvp-s3-auth-boundary\`，基于 \`feature/mvp-s2-browser-qa\`

## 一、本轮锁定的唯一目标

解决 S2 本地演示身份容易被误当成正式登录的问题。默认构建必须**绝不包含或暴露本地虚构账号 API**；正式身份接口保留与供应商无关的契约，不接入真实身份服务、注册和医疗数据。

### 本轮完成定义

| ID | 内容 | 验收口径 |
|---|---|---|
| S3-01 | 默认构建安全隔离 | \`wrangler.jsonc\` 默认入口是 \`src/release-gate/index.ts\`，不绑定 D1、不配置公开路由；所有请求均返回 503 |
| S3-02 | 演示入口显式隔离 | \`wrangler.local.jsonc\` 才引用 S2 Worker / 虚构身份 / 本地 D1；\`dev:api\` / \`db:migrate:local\` 显式指定配置 |
| S3-03 | 正式身份契约 | 新建独立 Principal、IdentityVerifier、IdentityLinkStore、SessionRevocationStore 接口；**没有实现正式供应商** |
| S3-04 | 安全配置校验 | OIDC issuer/redirect HTTPS、授权码 + PKCE S256、BFF 服务端会话、非空 audience 和 clientId 等校验 |
| S3-05 | 默认拒绝实际 HTTP 验证 | 启动默认 Worker：\`/demo\`、\`/api/v1/dev/session\`、\`/api/v1/events\` 等必须全部 503，无健康数据/令牌/Cookie |
| S3-06 | 回归 | 旧 S1/S2 API、虚构双账号浏览器验收、数据库和原型回归仍成功 |
| S3-07 | CI 防误部署 | 默认 Release Worker 打包后不含演示用户标识/签名密钥引用；所有变更在 Draft PR 评审 |

## 二、架构选择（只定协议/安全模式，不定供应商）

**选择的技术基线：符合 OpenID Connect 的授权码流程 + PKCE S256 + 服务端 BFF 会话。**

- 只允许已预先注册的精确回调地址；回调必须 HTTPS，不接受通配符和 URL 参数任意回跳。
- 授权请求将来必须有随机 \`state\`、\`nonce\`、一次性 \`code_verifier\` 与 PKCE S256，存储在短期受保护的事务上下文中。
- 回调必须验证 \`state/nonce\`、颁发方、接收对象、签名/JWKS、算法白名单、时钟与令牌有效期；不能只 decode JWT 就认为已登录。
- 浏览器不直接长期持有 Identity Provider 的 access token / refresh token；应用 BFF 签发安全 HttpOnly/Secure/SameSite Session Cookie。写接口配合 CSRF 策略、Origin 检验。
- 后端身份关系按 **issuer + subject** 组合键映射真实内部账号；不能用 email/手机号等可能变化的字段直接作为唯一主键。
- 认证成功不意味着自动具备健康数据访问权。还需隐私授权、个人档案链接及每对象权限校验。
- 会话吊销、最短必要保留、异常登录、数据删除和 KMS 是真实身份阶段门，不允许省略。

参考 RFC 9700 OAuth Security BCP（2025）：
https://www.rfc-editor.org/rfc/rfc9700.html

**未选定：** 实际用户采用手机、邮箱、第三方账号还是自建身份服务；也未选定具体 OIDC 供应商、云部署或数据驻留。标准不等于其供应商已经满足中国大陆或其他目标市场的法律要求。

## 三、两个完全分开的配置入口

\`\`\`mermaid
flowchart TB
  subgraph Local["本地虚构数据测试"]
    L[wrangler.local.jsonc] --> LD[src/mvp/index.ts]
    LD --> LK[本地随机密钥 + A/B 演示令牌]
    LD --> DB[(本地 D1)]
  end
  subgraph Default["默认构建 / 误部署防护"]
    P[wrangler.jsonc] --> G[src/release-gate/index.ts]
    G --> N[任何请求 503]
  end
  A[未来正式身份服务] -. 供应商和安全审核后另行实现 .-> F[正式 API]
\`\`\`

\`\`\`bash
# 仍然只能运行虚构数据服务
npm install
npm run dev:setup
npm run db:migrate:local
npm run dev:api
# http://127.0.0.1:8787/demo
\`\`\`

默认构建即使被意外发布，所有路由也返回 \`RELEASE_BLOCKED\` 503。**这只是纵深防护，不应代替正式环境的访问控制、账户审核和部署审批。**

## 四、本轮不做

- 不选手机号验证码、微信、邮箱/OIDC 服务商；不发送验证码、不创建真实账号。
- 不开放任何可处理真实健康资料的接口，不部署公有域名或云数据库。
- 不处理医嘱、实际服药、治疗、复诊、AI、OCR、PDF、家庭档案。
- 不改动 S1/S2 事件/症状业务模型及虚构数据接口行为。
- 不实现 OIDC 回调、生产令牌验签、Refresh Token、正式会话存储或用户自助删除；这些不是单靠接口文件就算完成的功能。

## 五、阻断与问题收敛

- **S3 阻断：** 默认 Worker 任何路由能访问演示身份/健康数据，默认构建绑定 D1，测试绕过安全配置，OIDC 配置允许 HTTP/隐式/无 PKCE 或 CI 失败。
- **后续身份 Sprint：** 明确地区与登录方式后，选择合规身份服务、完成正式安全回调和会话管理、用户/档案映射与撤销机制。
- **后续业务 Sprint：** 处方/报告/AI/OCR 等保留需求，不引入本轮。

遇到阻断按“复现、影响、最小修复、自动复测”处理。通过测试后关闭本轮，不借技术评审扩大范围。

## 六、交付物与当前结论

- \`src/release-gate/index.ts\`、\`wrangler.jsonc\`：默认发布闸门。
- \`wrangler.local.jsonc\`：显式本地模拟配置。
- \`src/auth/identity-contract.ts\`、\`src/auth/oidc-policy.ts\`：未实现具体厂商的身份接入契约与配置校验。
- \`tests/release-guard.test.mjs\`、\`tests/auth-policy.test.ts\`：发布拒绝和策略负面测试。
- CI \`auth-release-gate\` 作业：实际启动默认 Worker，验证 503 和打包不含演示身份。
- 完成状态以 CI 真实结果为准，不能因代码提交就称已验收。

**保留 Draft PR；没有真实身份认证和敏感数据保护验收，不允许真实用户注册、数据导入或公开部署。**
