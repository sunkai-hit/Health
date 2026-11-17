# Health API 契约 V0.1（设计稿，不是已上线 API）

- 日期：2026-11-17
- 规范：REST/JSON、\`/api/v1\`；资源 ID 使用 UUID/ULID，不可预测
- 状态：接口提议稿，**目前仓库没有正式业务 API 服务**
- 数据：只允许虚构测试资料；真实数据处理须通过隐私及安全阶段门

## 1. 通用规则

### 1.1 身份、归属和同意

- 所有健康记录 API 必须由服务端认证，使用当前认证会话确定当前 \`user_id\`，不相信客户端提交的 \`owner_id\`。
- 每次读取/写入事件时，经 \`event.profile_id → profile.owner_id\` 校验对象归属；不得因知道事件或附件 ID 就可以访问。
- 推荐 HttpOnly + Secure + SameSite Cookie 会话或等效安全机制；若采用 Cookie，写接口需要 CSRF 防护。
- AI/OCR/外部分享需要满足独立、目的明确的敏感数据授权。撤回后阻止后续处理请求，并说明先前合法处理数据的清理规则。
- 幂等写入可使用 \`Idempotency-Key\`，事件更新需要 \`If-Match\` 或版本号以避免覆盖并发修改。

### 1.2 时间、来源、缺省

- 时间使用 RFC3339 带时区/UTC，另外保存事件发生时间精度 \`exact|approximate|unknown\`。
- 来源：\`self_report|document_transcribed|ocr_draft|verified_import|ai_generated\`。\`verified_import\` 只能由可信机构集成路径设置，普通用户不可伪造。
- 未知字段为 \`null\` 或显式 \`unknown\`，**不自动填推测剂量、药名、诊断或服药时间**。
- 返回字段 \`created_at\`、\`updated_at\`、\`version\`；健康记录每次修改保留审计/修订引用。

### 1.3 错误协议

\`\`\`json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "输入格式不符合要求",
    "request_id": "req_demo",
    "details": [{"field":"occurred_at","reason":"INVALID_TIMESTAMP"}]
  }
}
\`\`\`

错误建议：\`401 UNAUTHENTICATED\`，\`403 FORBIDDEN\`，\`404 NOT_FOUND\`（避免泄露资源是否存在，跨用户资源可统一使用 404），\`409 VERSION_CONFLICT\`，\`422 VALIDATION_ERROR\`，\`429 RATE_LIMITED\`，\`503 AI_UNAVAILABLE\`。错误响应中不回显用户健康原文。

## 2. 核心接口目录

| 动作 | URL | 用途 |
|---|---|---|
| GET | /api/v1/me | 当前账号档案概要 |
| GET / PATCH | /api/v1/profiles/self | 个人健康档案（字段必要性另审） |
| GET / POST | /api/v1/events | 列表 / 新建健康事件 |
| GET / PATCH | /api/v1/events/:event_id | 事件详情 / 修改状态和标题 |
| GET / POST | /api/v1/events/:event_id/entries | 时间线条目；症状/观察/笔记 |
| PATCH / DELETE | /api/v1/events/:event_id/entries/:entry_id | 修订 / 删除（留痕） |
| GET / POST | /api/v1/events/:event_id/encounters | 就诊记录 |
| GET / POST | /api/v1/events/:event_id/orders | 医嘱/处方及多药明细 |
| GET / POST | /api/v1/events/:event_id/medication-uses | 用户实际服药 |
| GET / POST | /api/v1/events/:event_id/treatments | 实际治疗 |
| GET / POST | /api/v1/events/:event_id/reports | 生成前预览 / 确认生成报告 |
| GET | /api/v1/reports/:report_id | 报告快照下载元数据 |
| POST | /api/v1/attachments/upload-intents | 请求私有附件上传授权（**后续**） |
| POST | /api/v1/ocr/drafts | OCR 候选草稿（**后续**） |
| GET / POST | /api/v1/consents | 授权列表 / 同意或撤回 |
| POST | /api/v1/ai/question-suggestions | 事件感知问询建议（**可选，默认关闭**） |
| POST | /api/v1/data-exports | 个人数据导出申请（**生产必要**） |
| POST | /api/v1/account-deletion | 账户/数据删除申请（**生产必要**） |

URL 为设计口径；原型尚未实现这些路径。

## 3. 典型请求与校验

### 3.1 新建健康事件

\`\`\`http
POST /api/v1/events
Content-Type: application/json
Idempotency-Key: demo-unique-key
\`\`\`

\`\`\`json
{"title":"腹部不适（虚构）","onset_at":"2026-11-15T08:30:00+08:00","onset_precision":"exact"}
\`\`\`

返回 \`201\`，包含不可预测 \`id\`、\`status:open\`、\`version:1\`；不将未描述的疾病写为确诊。

### 3.2 新增带人体标记的症状

\`\`\`http
POST /api/v1/events/evt_demo/entries
\`\`\`

\`\`\`json
{
  "kind":"symptom",
  "occurred_at":"2026-11-15T08:30:00+08:00",
  "occurred_precision":"exact",
  "source_type":"self_report",
  "symptoms":["胀痛"],
  "severity":null,
  "body_marks":[
    {"body_map_version":"v1","view":"front","zone_code":"upper-abd","segment_code":"right-upper-abd"}
  ],
  "radiation":null,
  "narrative":"吃饭后有所变化（虚构）"
}
\`\`\`

服务端验证 \`segment_code\` 属于指定 \`zone_code\`、\`severity\` 可为空否则在 0～10、放射起终点属于本记录的位置。不能凭位置编码推断器官疾病。

### 3.3 新增含两种药品的医嘱（用户转录）

\`\`\`http
POST /api/v1/events/evt_demo/orders
\`\`\`

\`\`\`json
{
  "order_type":"prescription",
  "issued_at":"2026-11-16T10:28:00+08:00",
  "encounter_id":"enc_demo",
  "source_type":"document_transcribed",
  "original_text":"完全虚构的处方示例",
  "supersedes_order_id":"ord_old_demo",
  "items":[
    {"client_item_key":"item_a","drug_name_original":"虚构药品甲","strength_original":null,"dose_original":null,"frequency_original":null,"duration_original":null},
    {"client_item_key":"item_b","drug_name_original":"虚构药品乙","strength_original":null,"dose_original":null,"frequency_original":null,"duration_original":null}
  ]
}
\`\`\`

服务端验证：
- 本事件与 \`encounter_id\`、\`supersedes_order_id\` 的用户归属及事件一致。
- \`supersedes_order_id\` 不可形成环/指向自己；需同类医嘱，保留旧版内容。
- 用药明细写入与医嘱为单个事务，部分失败全部回滚。
- 缺少剂量/频次/疗程可以保留 null，不自动编造。
- \`source_type=verified_import\` 必须拒绝普通会话设置。

### 3.4 记录实际服药

\`\`\`http
POST /api/v1/events/evt_demo/medication-uses
\`\`\`

\`\`\`json
{
  "occurred_at":"2026-11-16T12:00:00+08:00",
  "drug_name_original":"虚构药品甲",
  "actual_dose_original":"1片（虚构）",
  "usage_status":"actual",
  "instruction_id":"ord_demo",
  "prescription_item_id":"item_server_generated",
  "notes":"主观感受记录"
}
\`\`\`

验证：处方项必须属于所引用医嘱、同一健康事件及当前用户。**API 绝不根据处方创建实际服药记录**。如果缺乏实际服药的足够事实，可以创建“未知/未确认”草稿而不能冒称 actual。

### 3.5 复诊计划与实际就诊

复诊是 \`order_type=followup\` 的医嘱，包含建议日期/原文；\`POST /events/:id/encounters\` 可选传 \`followup_order_id\`，作为用户主动关联的就诊事实。关联数为 0 不代表真实未就诊。跨事件引用如需支持须单独建授权及关联规则，V0.1 同事件内引用。

### 3.6 报告预览与快照

\`\`\`http
POST /api/v1/events/evt_demo/reports
\`\`\`

\`\`\`json
{
  "mode":"full_course",
  "include_ai_appendix":false,
  "included_entry_ids":["entry_1","entry_2"],
  "confirmed_by_user":true
}
\`\`\`

建议返回 \`202 Accepted\` 与 \`report_id\`、任务状态；后台完成后生成不可变快照、来源 ID 列表、生成时间。前端只对已确认的用户可见；分享必须用户主动操作且使用短有效期链接。

## 4. AI 接口的保护边界

\`POST /api/v1/ai/question-suggestions\` 仅为未来可选接口：

- 输入：事件 ID、用户允许的条目范围、用途、授权引用。
- 输出：建议补充的非诊断性问题和对应缺失字段；不返回诊断或分诊结论。
- 模型调用由服务端控制，密钥在 Secrets / KMS，禁止出现在前端或公开仓库。
- 默认不可用不阻塞 \`POST /entries\`，不对用户产生“安全/低风险”结论。
- 独立的医学紧急风险规则不通过 AI 接口自行决定是否发布。

## 5. 事务、版本和日志

- 插入一张处方与 N 个药品明细需原子事务，避免半张处方。
- 写入后每条对象 \`version\` 递增；冲突返回 \`409\`，不得静默覆盖医生原文或实际服药历史。
- 修改/删除保留用户可见修订历史，真正个人数据永久删除根据合规策略移除相关原文与附件。
- 审计仅记录操作/ID/结果/时间/请求关联标识，**不写入药名、症状、医疗文字及 AI 原文**。
- 为列表接口采用 \`limit/cursor\`，上限受服务端控制；禁止通过无界查询导出其他用户记录。

## 6. 验收测试重点

1. 用户 A 不能读取/修改用户 B 的事件、处方、附件、报告（需 API 安全测试）。
2. 处方项错配、跨事件医嘱关联、伪造来源均返回 4xx，不发生写入。
3. 同一个 Idempotency-Key 重试不会多生成处方/实际用药。
4. 医嘱版本引用保留原始内容；跨事件或循环引用失败。
5. 未知时间、未知用量及缺失内容不由后端自动猜测。
6. 生成报告必须明确来源，不因后续编辑悄然修改历史导出文件。
7. 无 AI 授权或模型故障时核心健康事件和报告仍可完成。

**所有以上接口均为需求级契约，尚未实现、测试或发布为实际服务。**
