# Health — 个人健康记录与 AI 辅助就医助手

> 产品状态：需求分析（V0.1，待评审）  
> 建立日期：2026-11-17

## 项目定位

以健康事件为中心，让用户通过人体部位图、文本/语音快速记录身体不适、用药、就医与检查信息；通过审慎设计的 AI 辅助问询和风险提示改善就医沟通，并生成可追溯的就医摘要。

**核心原则：** 记录简单；风险识别谨慎；报告专业；隐私优先。

## 交互原型（需求评审版）

- 原型目录：[`prototype/v0.1/`](./prototype/v0.1/)
- 使用说明：[`prototype/v0.1/README.md`](./prototype/v0.1/README.md)
- 交互规格：[`docs/UX-SPEC-V0.1.md`](./docs/UX-SPEC-V0.1.md)

原型文件在 `docs/requirements-v0.1` 需求分支上，尚未合入 `main`。请先评审 Draft PR #1。原型采用虚构数据，不能用于真实病情判断。

## 文档及协作

- 产品需求基线：`docs/PRD-V0.1.md`
- V0.1 功能清单：`docs/FUNCTION-LIST-V0.1.md`
- 概念数据模型：`docs/DATA-MODEL-V0.1.md`
- AI 安全与风险控制：`docs/AI-SAFETY-V0.1.md`
- 待确认产品决策：`docs/OPEN-DECISIONS.md`
- 项目阶段规划：`docs/ROADMAP.md`

需求阶段采用 **Draft PR 评审、Issues 跟踪、确认后合入主分支** 的协作方式。

## 特别注意：隐私及临床边界

当前仓库为公开仓库。**严禁提交真实个人健康记录、病历、检查报告、身份信息、凭据、API 密钥以及可识别的日志**。测试资料必须为虚构或合规去标识化数据。

本项目在 V0.1 阶段为健康信息记录、整理与一般性就医提示产品；不提供确诊、处方、剂量调整或代替专业医疗判断的服务。AI 的风险提示不能被理解为排除严重疾病的依据。商业化或公开发布前应另行完成适用地区的法规、隐私和临床安全评估。

## 技术方向（建议，尚未定稿）

移动端优先的 PWA；模块化后端；健康记录、风险规则与 AI 辅助分析解耦。技术选型在需求评审通过后再确认。


## 2026-11-17 需求与原型迭代

- 用户已同意沿现有设计继续深化，新增“医生医嘱、处方、实际治疗和用药记录纳入全程健康事件与就医报告”的需求。
- 专题需求：[\`docs/CARE-AND-ORDERS-V0.1.md\`](./docs/CARE-AND-ORDERS-V0.1.md)
- 自适应问询设计：[\`docs/QUESTIONNAIRE-DESIGN-V0.1.md\`](./docs/QUESTIONNAIRE-DESIGN-V0.1.md)
- 浏览器原型新增：二级身体区域、症状延伸方向、就医/医嘱/治疗记录和报告双视图。
- 协作跟踪：[Care Epic #9](https://github.com/sunkai-hit/Health/issues/9)。
- 尚待评审：精准点位与二级字典覆盖、多药处方明细、医疗文件上传核验、报告隐私遮蔽及临床/安全验证。

### 单文件原型预览

下载 [`prototype/v0.1/preview.html`](./prototype/v0.1/preview.html) 后可直接在浏览器体验，无需启动服务器。它集成了页面、样式和脚本，是当前需求分支中的便携演示版（只包含虚构示例和页面内存数据）。


## 最新进展：多药处方及复诊管理原型

- [处方、医嘱版本与复诊需求](./docs/PRESCRIPTION-FOLLOWUP-V0.1.md)
- [便携离线预览](./prototype/v0.1/preview.html)
- 已加入多药处方明细、医嘱版本替代、实际用药药品项关联、复诊计划和对照视图。
- 原型中图片仅本地预览，不上传、不 OCR，也不会保存真实患者数据。
- 仍处于 Draft PR 评审阶段，未合入 main。


## 工程基线与自动化验收（2026-11-17）

- [技术架构 V0.1](./docs/TECH-ARCHITECTURE-V0.1.md)：部署可替换的 PWA/API/关系数据库/私有附件架构
- [API 契约](./docs/API-CONTRACT-V0.1.md)：健康事件、医嘱、实际用药、治疗、复诊、报告设计
- [安全与隐私设计](./docs/SECURITY-PRIVACY-V0.1.md)：授权、越权校验、加密、AI/OCR 数据治理
- [SQLite 初始迁移草案](./db/migrations/0001_initial.sql)
- [CI 实测结果](./docs/QA-RESULTS-2026-11-17.md)：桌面/模拟移动浏览器 18/18 通过，SQLite 8/8 通过
- [GitHub Actions](./.github/workflows/prototype-e2e.yml)：PR 自动运行原型测试及数据库基本检查
- [架构实施 Epic #12](https://github.com/sunkai-hit/Health/issues/12)

**研发阶段门：** 当前只有虚构数据原型、技术设计、数据库草案和自动化测试。尚未完成可存真实健康数据的 API、云端部署、合规评估、加密密钥管理或真实医学分诊。


## 研发进展：S1 / S2（本地虚构数据）

- [S1 PR #13](https://github.com/sunkai-hit/Health/pull/13)：本地 Worker + D1 健康事件/症状/时间线，41 项 CI 检查通过。
- [S2 PR #15](https://github.com/sunkai-hit/Health/pull/15)：双虚构身份、短期签名演示令牌和事件/症状服务端归属隔离，53 项 CI 检查通过。
- [S2 范围与不做事项](./docs/SPRINT-S2-BOUNDARY.md)
- [S2 验收与问题收敛](./docs/SPRINT-S2-ACCEPTANCE.md)
- [本地 API 运行说明](./src/mvp/README.md)

**未合入 main，未公开部署。** A/B 演示令牌可由本地使用者任意申请，不是生产登录；仓库是 Public，禁止录入真实病历、患者信息和任何敏感数据。


## S2 联调页浏览器验收补强（2026-11-17）

- [PR #17](https://github.com/sunkai-hit/Health/pull/17)：真正通过本地 Worker + D1 执行虚构 A/B 账户浏览器 E2E
- [验收和竞态问题记录](./docs/SPRINT-S2-BROWSER-QA-RESULTS.md)
- [CI 修复后运行](https://github.com/sunkai-hit/Health/actions/runs/44025858347)：12/12 新浏览器、27/27 API、8/8 SQLite、18/18 旧原型，共 65/65 通过
- 发现并修复快速身份切换的过期请求覆盖当前界面问题；不引入新业务范围

**警告：** 演示账号不是真实身份认证，仍然不能保存真实健康资料或公开部署。


## Sprint S3｜默认禁止发布与正式身份接入契约（2026-11-17）

- [Draft PR #19](https://github.com/sunkai-hit/Health/pull/19) · [S3 范围](./docs/SPRINT-S3-AUTH-BOUNDARY.md) · [S3 验收记录](./docs/SPRINT-S3-ACCEPTANCE.md)
- **默认 \`wrangler.jsonc\` 是禁止业务发布的安全入口**：不绑定虚构健康数据存储；所有路径统一 503 \`RELEASE_BLOCKED\`。
- 原 A/B 虚构身份 Worker 已移至 \`wrangler.local.jsonc\`。通过 \`npm run dev:setup && npm run db:migrate:local && npm run dev:api\` 启动本地合成数据服务。
- 已新增供应商无关的 OIDC/BFF 身份契约及安全配置校验；**没有真实登录、授权回调、用户会话或生产数据处理能力**。
- [CI 运行 44038625299](https://github.com/sunkai-hit/Health/actions/runs/44038625299)：OIDC 策略16、默认拒绝 HTTP7、API27、SQLite8、原型18、S2 真实联调页12，**88 项检查全部通过，五作业成功**。
- 正式身份供应商、目标地区、隐私授权、KMS/密钥轮换等仍是发布前置条件；禁止把演示身份用于真实患者资料。


## 首发市场与客户端已确认（2026-11-17 · S4）

- **首批用户：中国大陆；首发形态：微信原生小程序**，PWA/旧版单文件 HTML 仅作为历史原型与交互参考。
- [ADR-0001 中国大陆微信小程序架构决策](./docs/ADR-0001-CHINA-WECHAT-LAUNCH.md) · [S4 开发边界](./docs/SPRINT-S4-WECHAT-SCOPE.md)
- [S4 Draft PR #21](https://github.com/sunkai-hit/Health/pull/21) · [微信原生工程](./miniapp/) · [本地导入说明](./miniapp/README.md)
- 登录路径调整为**微信 \`wx.login\` → 服务端 code2Session → Health 自有会话**。现有 S3 OIDC 契约保留作为其他平台可选方案，不阻断微信小程序首发。
- S4 仅交付只读虚构事件/时间线骨架及微信服务端身份交换的**可模拟测试函数**；未启用真实登录、真实数据录入或生产部署。
- 首发建议部署与处理健康数据的基础设施位于中国大陆境内；具体云商、合法 API 域名、小程序主体/AppID、备案、隐私授权与 KMS/删除机制仍是独立发布前置条件。

**公开仓库严禁提交真实病历、微信 AppSecret、敏感个人信息或医疗图像。**


**小程序 AppID 已配置（2026-11-18）：** `wx027f1a9c66e3c01a`，见 [`miniapp/project.config.json`](./miniapp/project.config.json)。这是公开应用标识，不是 AppSecret；平台权限/备案及真实登录尚未验证，也未开放健康数据收集。


## S5 · 无自有服务器/HTTPS 域名的微信云开发研发方案（2026-11-18）

- 项目方尚无云服务器或自有 HTTPS 域名；首发小程序优先采用 **微信·云开发 CloudBase（原生 wx.cloud）** 作为测试和后续候选架构。
- [S5 Draft PR #23](https://github.com/sunkai-hit/Health/pull/23) · [ADR-0002](./docs/ADR-0002-S5-CLOUDBASE-BOOTSTRAP.md) · [S5 锁定范围](./docs/SPRINT-S5-CLOUDBASE-SCOPE.md) · [云开发开通说明](./miniapp/CLOUDBASE-SETUP.md)
- 小程序新增只读云函数连接测试页和固定合成数据 \`healthDevPing\`，**仓库默认云开关关闭、环境 ID 为空，不会发生真实网络请求或存储健康数据**。
- 该方案可通过 \`wx.cloud.callFunction\` 调用云函数，**不必先购买自有服务器或域名**；早期 \`code2Session\` 自建 API 方案转为备选。
- **云开发环境尚未创建/绑定，云函数尚未实际部署；小程序备案、类目、敏感健康信息保护与正式发布审批仍为前置条件。**


## S5 云开发环境 ID 已配置（2026-11-18）

项目方已提供 `health-d2gxjb20h1d33fa91`，并与公开 AppID `wx027f1a9c66e3c01a` 一起纳入**合成数据测试配置**。原生小程序当前允许 SDK 初始化，但**不自动发起云函数调用**；需要开发者工具手工部署 `healthDevPing`，再到联调页面点击「验证云函数连接」。此举不意味着已完成平台环境关联、正式微信登录或健康数据安全上线。

操作见 [CloudBase 实际连接指南](./miniapp/CLOUDBASE-SETUP.md)，变更在 [S5 Draft PR #23](https://github.com/sunkai-hit/Health/pull/23)。
