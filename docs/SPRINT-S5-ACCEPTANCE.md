# Health S5｜CloudBase 无自有服务器/域名研发验收报告

日期：2026-11-18
分支：\`feature/mvp-s5-cloudbase-dev\`
CI 验证：https://github.com/sunkai-hit/Health/actions/runs/44203503065
状态：**S5 模拟测试和代码验收通过；没有真实云环境，也未联通/部署微信云函数。**

## 1. 本轮唯一目标

用户已有小程序 AppID \`wx027f1a9c66e3c01a\`、但无自有服务器或 HTTPS 域名，不能因此阻断小程序研发。已选用微信·云开发（原生 \`wx.cloud\`）作为 S5 的初始测试方案，并与此前独立 HTTP API 的 \`code2Session\` 路线明确区分。

**本轮不实际连接云开发环境、读取微信身份或存储医疗健康数据。**

## 2. 实际交付内容

- \`miniapp/config/cloud-env.js\`：默认 \`enabled:false\`、\`envId:''\`；没有环境或显式启用，不初始化 CloudBase。
- \`miniapp/app.js\`：仅在显式启用且环境 ID 合法时调用 \`wx.cloud.init\`；\`traceUser:false\`。
- \`miniapp/cloudfunctions/healthDevPing/index.js\`：固定 \`synthetic-read-only\` 状态，忽略所有入参，不读取 \`openid\`、不访问数据库，不开写接口。
- \`miniapp/pages/dev-cloud\`：云函数连接测试 UI。未配置环境时按钮禁用；实际请求只能调用 \`healthDevPing\`。
- \`miniapp/project.config.json\`：\`cloudfunctionRoot\` 明确指向 \`cloudfunctions/\`。
- \`tests/cloudbase-dev.test.mjs\`：默认禁用、环境白名单、安全开关、模拟云函数调用、错误响应及零数据库/零敏感数据通道测试。
- 文档：ADR-0002、S5 锁定范围和微信开发者工具云环境开通说明。

## 3. GitHub Actions 真实结果

### 第一次运行：静态检查出现误报

[run 44203294386](https://github.com/sunkai-hit/Health/actions/runs/44203294386)：7 个作业中 6 个 success，\`cloudbase-dev\` 有 1 项失败，其他 9 项新增测试通过。

原因：新检查中的正则匹配了旧示例代码**注释**里出现的 \`wx.request\` 文字，将未执行的文字误判成了网络调用。

最小修复：把静态判断从“包含 \`wx.request\` 标记”改为“出现 \`wx.request(...)\` 实际函数调用”。原业务代码未修改，没有放宽真实网络请求的安全边界。

### 修复后全量回归

[run 44203503065](https://github.com/sunkai-hit/Health/actions/runs/44203503065)：

| 测试类别 | 实际结果 |
|---|---:|
| 新 CloudBase 模拟与默认禁用保护 | 10/10 |
| 微信 code2Session（备用路径）单元测试 | 14/14 |
| 微信小程序工程/只读安全 | 6/6 |
| 既有 S3 OIDC 配置策略 | 16/16 |
| S3 默认 Worker HTTP 发布阻断 | 7/7 |
| S1/S2 API HTTP 集成 | 27/27 |
| SQLite 数据模型与约束 | 8/8 |
| 原 HTML 原型浏览器回归 | 18/18 |
| 本地虚构 A/B 用户浏览器回归 | 12/12 |
| **独立检查合计** | **118/118** |

**7/7 CI 作业全部 success**：\`cloudbase-dev\`、\`wechat-mini-foundation\`、\`auth-release-gate\`、\`mvp-api\`、\`sqlite-schema\`、\`prototype-browser\` 和 \`mvp-browser\`。微信原生工程和发布闸门在多作业中重复运行的断言只按一次计数；TypeScript、bundle build 和敏感字符串扫描属于另外通过的编译/安全门槛。

## 4. 研发状态与生产阶段门

**已完成**：S5 代码与模拟 CI 验收、默认不联网、云环境手动配置入口、只读虚构数据探针。

**未完成（不可冒称已做）**：
- 尚未通过微信开发者工具开通/关联实际 CloudBase 环境，没有可用环境 ID。
- 尚未向任何云环境部署 \`healthDevPing\`，因此**未做真实 \`wx.cloud.callFunction\` 网络联通、模拟器或真机验收**。
- 尚未获取真实 OpenID、未开发微信用户档案/账号/权限，也无云数据库和健康信息处理。
- 未核验云资源所属地区、账单/配额/日志安全，未完成小程序备案或平台类目。
- 医疗健康信息仍属于敏感个人信息，正式上线前必须落实告知与单独同意、服务端逐对象权限、加密/KMS、备份、导出删除和审计。
- 处方、用药、报告、AI/OCR、家庭账号均未扩入本轮。

## 5. 下一步最小依赖

项目方须在其具有权限的微信开发者工具中，**手工创建并关联一个中国大陆地域的微信·云开发测试环境**，随后提供**环境 ID**（非密钥）。按照 \`miniapp/CLOUDBASE-SETUP.md\` 在本地启用开关和上传固定云函数，才能做真实的前端 → 云函数联调。

即使真实测试环境联通也只代表该测试函数可调用，不可据此处理真实病历或宣布正式微信登录已完成。

[ADR-0002](./ADR-0002-S5-CLOUDBASE-BOOTSTRAP.md) · [S5 研发边界](./SPRINT-S5-CLOUDBASE-SCOPE.md) · [云环境创建步骤](../miniapp/CLOUDBASE-SETUP.md)


## 2026-11-18 云环境 ID 已提供后的补充联调准备

- 项目方现已提供 CloudBase 环境 ID `health-d2gxjb20h1d33fa91`，并保留原 AppID `wx027f1a9c66e3c01a`。
- 已在 `miniapp/config/cloud-env.js` 配置该环境的 `enabled:true` 与 `purpose:'synthetic-ping-only'`。这表示**允许 SDK 初始化，并不代表云环境已成功关联或云函数已被部署**。
- 页面上的 `healthDevPing` 仍然只能通过用户手动点击调用。没有自动云函数请求、没有任何身份信息提取，也没有健康数据写入。
- 更新了专用自动化检查：SDK 启动不调用云函数，错误环境/错误目的保持禁用，初始化失败不得启用连接按钮，真实云函数响应仍须符合合成数据格式。
- **尚待真实验收**：项目方在微信开发者工具中将 `healthDevPing` 上传部署至该云环境，并实测小程序手动请求。其关联、地域、收费/配额、后台管理权限均未通过 API 验证。
- 新配置提交后的 CI 结果见对应 PR #23 的最新 Actions；前述 118/118 是**环境 ID 配置之前的历史验收**，不得将它误写成当前代码版本的全绿结论。


## 2026-11-18 配置环境 ID 后的实际 CI 复验结论

项目方提供 `health-d2gxjb20h1d33fa91` 后，`miniapp/config/cloud-env.js` 配置为 `enabled:true`、`purpose:'synthetic-ping-only'`。程序启动时只进行 CloudBase SDK 的受控初始化，**仅用户点击测试按钮时才会调用固定云函数**，仍不进行身份读取或健康信息写入。

[GitHub Actions 44207467966](https://github.com/sunkai-hit/Health/actions/runs/44207467966) **7/7 作业全部 success**。按去重的可计数测试项统计：
- CloudBase 环境与手动探针安全：11/11；
- 微信 code2Session 备选适配器：14/14；原生小程序静态测试：6/6；
- S3 OIDC 配置：16/16；默认 Worker 业务路径拒绝：7/7；
- S2 API：27/27；SQLite：8/8；旧原型浏览器：18/18；本地双账号 Worker 浏览器：12/12；
- **总计 119/119 项通过**，以及 TypeScript、默认发布 bundle 额外检查成功。

本轮增加了 SDK 初始化失败时禁用手工云连接按钮的负面测试。配置文件只存放环境 ID（非密钥），不存放 AppSecret 或个人信息。

**验收界限：** 这些仍是 GitHub CI 本地/模拟检查，并非云端已部署证明。微信开发者工具登录权限、AppID/环境关联、`healthDevPing` 实际部署、手工真机调用及所在地域/账单仍待项目方验证。本次只关闭“环境 ID 配置及本地自动化回归”这一阶段，**云端联通待验收**。
