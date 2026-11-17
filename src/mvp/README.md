# Health S1｜本地运行与联调

此目录是第一条真正可运行的 MVP API 研发切片，**仅限虚构数据、本地调试**，不具备真实患者资料安全保护条件。

## 最小功能

- \`GET /api/v1/health\`：本地演示健康检查
- \`GET/POST /api/v1/events\`：事件列表/创建
- \`GET /api/v1/events/:id\`：事件详情与症状时间线
- \`GET/POST /api/v1/events/:id/entries\`：症状列表/创建
- \`GET /demo\`：本地 API 联调网页

超出此清单的能力一律不在 S1 中实现；处方/实际用药/AI/报告仍在此前的需求文档和旧版原型中，不代表当前服务提供接口。

## 本地准备

需要 Node.js 22、npm 和网络安装依赖。请只使用虚构测试数据：

\`\`\`bash
npm install
npm run dev:setup
npm run db:migrate:local
npm run dev:api
\`\`\`

然后打开 http://127.0.0.1:8787/demo 。

- \`npm run dev:setup\` 生成不提交 Git 的 \`.dev.vars\`，其中有 \`DEMO_MODE=local\` 和随机 AES 密钥。
- \`npm run db:migrate:local\` 使用 Wrangler 的**本地 D1 模拟数据库**，只应用 \`db/migrations/0001_initial.sql\`。
- \`npm run dev:api\` 绑定 127.0.0.1；未启用本地演示或缺少正确密钥时 API 拒绝访问。
- Worker 配置中 \`workers_dev=false\`，没有配置公开路由；**不要运行 \`wrangler deploy\`**。
- 本地数据库存于 \`.wrangler/\`（Git 已忽略）。清理本地数据可删除这个目录，但会永久丢失所有演示记录。密钥丢失时已有加密数据不可恢复。

## 运行测试

\`\`\`bash
npm run check:types
npm run test:api
npm run test:db
npm run test:prototype
\`\`\`

其中 \`test:api\` 会自行启动本地 Worker 并调用真实 HTTP API，测试事件、症状、输入校验、未知时间、身体编码、排除伪造来源与未支持接口。请先运行一次本地迁移。

## 数据与安全边界

- 事件标题和症状/身体定位 JSON 使用 AES-256-GCM 加密后写入 D1 的 BLOB 字段，数据库不直接保存这些字段的明文。
- 应用层密钥仅用于这台开发机器上的虚构数据；无 KMS、无正式加密密钥轮换，不能用作生产。
- API 当前共享固定的 \`synthetic-owner-v1\` 档案；**这不是用户认证体系**。localhost 限制也是研发防误用开关，不是完整的生产网络防护。
- 所有数据使用虚构示例；不得导入个人姓名、健康报告、医生医嘱、真实症状或处方图片。
- 旧版 \`prototype/v0.1/\` 是更全面的纯前端演示，当前 S1 的 \`/demo\` 是缩减版服务联调页面。S1 不移植整套界面。
- 不启用真实 AI、临床分诊、OCR、处方、用药、对外报告或对外部署。

## 扩展阶段门

真实用户接入前必须完成：登录认证、逐对象授权、数据存储地域决策、正式加密和 KMS、单独同意及数据删除/导出、附件保护和生产安全测试。AI 紧急风险分级还须独立完成医学和监管评审。

研发任务范围见 [SPRINT-S1-BOUNDARY.md](../../docs/SPRINT-S1-BOUNDARY.md)，上游业务基线见 [PRD V0.1](../../docs/PRD-V0.1.md)。
