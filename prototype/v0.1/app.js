/* Health V0.1 browser-only interactive prototype.
   All data is fictitious. No persistence, backend, telemetry, or real AI. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
  const example = {
    id: "demo-e1", title: "腹部不适（虚构示例）", start: "2026-11-15T08:30",
    status: "进行中", entries: [
      { id: "demo-s1", kind: "symptom", when: "2026-11-15T08:30", zones: [{ key: "front:upper-abd", label: "上腹部" }], symptoms: ["胀痛", "恶心"], severity: 6, notes: "上午开始感觉腹部胀痛，伴轻微恶心。（虚构）" },
      { id: "demo-m1", kind: "med", when: "2026-11-15T09:10", name: "演示药品 A（虚构）", dose: "1", unit: "片", notes: "记录一次实际用药；不代表任何用药建议。" },
      { id: "demo-s2", kind: "symptom", when: "2026-11-15T11:30", zones: [{ key: "front:upper-abd", label: "上腹部" }], symptoms: ["胀痛"], severity: 3, notes: "主观不适程度有所减轻。（虚构）" },
      { id: "demo-v1", kind: "visit", when: "2026-11-16T10:00", hospital: "演示医疗机构（虚构）", department: "演示门诊", notes: "医生具体意见由患者转录，待与正式医疗文书核对。（虚构）" },
      { id: "demo-o1", kind: "order", when: "2026-11-16T10:20", visitId: "demo-v1", orderType: "followup", text: "示例：医生建议复诊时带上此前的检查记录（完全虚构）", dueDate:"2026-11-25", sourceType: "self", executionStatus: "unknown" },
      { id: "demo-o-old", kind:"order",when:"2026-11-16T10:23",visitId:"demo-v1",orderType:"prescription",text:"虚构的处方记录（旧版）",sourceType:"self",executionStatus:"unknown",
        items:[{id:"demo-p-old",name:"虚构药品甲",strength:"未记录",doseText:"未记录",frequency:"未记录",duration:"未记录"}] },
      { id: "demo-o-new", kind:"order",when:"2026-11-16T10:28",visitId:"demo-v1",orderType:"prescription",text:"虚构处方的新版本，仅用于演示变更历史",supersedes:"demo-o-old",sourceType:"document",executionStatus:"unknown",
        items:[{id:"demo-p1",name:"虚构药品甲",strength:"未记录",doseText:"未记录",frequency:"未记录",duration:"未记录"},{id:"demo-p2",name:"虚构药品乙",strength:"未记录",doseText:"未记录",frequency:"未记录",duration:"未记录"}] },
      {id:"demo-m2",kind:"med",when:"2026-11-16T12:00",name:"虚构药品甲",dose:"1",unit:"片",notes:"完全虚构的实际服用记录。",orderId:"demo-o-new",itemId:"demo-p1"},
      { id: "demo-t1", kind: "treatment", when: "2026-11-16T10:45", name: "虚构的门诊处理项目", details: "仅用于展示治疗执行与医嘱分开的记录方式。", orderId: "" }
    ]
  };
  let state = {
    events: [JSON.parse(JSON.stringify(example))],
    currentEventId: "demo-e1", view: "home", bodyView: "front",
    zones: new Map(), activeZone: null, radiationFrom: "", radiationTo: "", unlocated: false, symptoms: new Set(), qaIndex: 0, qaAnswers: [],
    reportIncludeAI: false
  };
  const routes = {
    home: ["首页概览", "让每一次身体变化，都有迹可循", "记录当下的不适，为下一次就医留下清楚的线索。"],
    record: ["记录不适", "记录身体发出的信号", "选择部位、描述感受、留下发生时间。"],
    events: ["健康事件", "把零散信息，连接成一段清晰的经过", "从第一次不舒服，到用药和恢复变化。"],
    medication: ["用药记录", "实际服用了什么，记得清清楚楚", "坚持记录事实，避免自动猜测剂量和效果。"],
    care: ["就医与医嘱", "把医生的要求和实际治疗记录清楚", "就诊、处方/医嘱、实际治疗分开登记，避免混淆。"],
    ai: ["AI 辅助", "更有条理地描述身体情况", "演示引导问询体验，未提供真实医学分诊。"],
    report: ["就医报告", "就医之前，把重要信息准备好", "可追溯的健康事件摘要与实际用药时间线。"]
  };
  const silhouettes = [
    '<ellipse class="body-outline" cx="160" cy="58" rx="27" ry="35"/>',
    '<path class="body-outline" d="M149 89 L171 89 L177 109 L143 109 Z"/>',
    '<path class="body-outline" d="M126 108 Q116 119 114 152 L123 268 Q125 289 160 288 Q195 289 197 268 L206 152 Q204 119 194 108 Z"/>',
    '<path class="body-outline" d="M125 111 L103 116 Q91 120 85 144 L60 226 Q58 235 73 241 Q82 241 86 229 L111 169 L128 148 Z"/>',
    '<path class="body-outline" d="M195 111 L217 116 Q229 120 235 144 L260 226 Q262 235 247 241 Q238 241 234 229 L209 169 L192 148 Z"/>',
    '<path class="body-outline" d="M126 274 L159 280 L157 371 L149 457 Q147 479 133 477 L121 468 L120 368 Z"/>',
    '<path class="body-outline" d="M194 274 L161 280 L163 371 L171 457 Q173 479 187 477 L199 468 L200 368 Z"/>'
  ].join("");
  // Anatomical left/right are from the person's perspective (viewer perspective is reversed).
  const zonesFront = [
    ["head", "头部", "M160 25 C177 25 187 42 186 60 C185 77 175 89 160 90 C145 89 135 77 134 60 C133 42 143 25 160 25Z"],
    ["neck", "颈前", "M150 91 L170 91 L175 111 L145 111Z"],
    ["shoulder-right", "右肩", "M125 111 L103 119 L94 140 L117 149 L130 130Z"],
    ["shoulder-left", "左肩", "M195 111 L217 119 L226 140 L203 149 L190 130Z"],
    ["chest-right", "右胸", "M128 112 L158 112 L158 162 L120 162 L118 146Z"],
    ["chest-left", "左胸", "M162 112 L192 112 L202 146 L200 162 L162 162Z"],
    ["upper-abd", "上腹部", "M121 166 L199 166 L195 203 L125 203Z"],
    ["navel", "脐周", "M126 207 L194 207 L193 240 L127 240Z"],
    ["lower-abd-right", "右下腹", "M128 244 L158 244 L158 284 L125 271Z"],
    ["lower-abd-left", "左下腹", "M162 244 L192 244 L195 271 L162 284Z"],
    ["arm-right", "右上肢", "M92 145 L111 154 L85 226 L64 225Z"],
    ["arm-left", "左上肢", "M228 145 L209 154 L235 226 L256 225Z"],
    ["hand-right", "右手", "M63 228 L83 232 L76 252 Q66 265 57 248Z"],
    ["hand-left", "左手", "M257 228 L237 232 L244 252 Q254 265 263 248Z"],
    ["thigh-right", "右大腿", "M127 283 L156 288 L154 372 L122 371Z"],
    ["thigh-left", "左大腿", "M193 283 L164 288 L166 372 L198 371Z"],
    ["calf-right", "右小腿", "M123 375 L153 375 L147 460 L124 463Z"],
    ["calf-left", "左小腿", "M197 375 L167 375 L173 460 L196 463Z"]
  ];
  const zonesBack = [
    ["head-back", "后脑", "M160 25 C177 25 187 42 186 60 C185 77 175 89 160 90 C145 89 135 77 134 60 C133 42 143 25 160 25Z"],
    ["neck-back", "后颈", "M150 91 L170 91 L175 111 L145 111Z"],
    ["shoulder-right-back", "右肩背", "M125 111 L103 119 L94 140 L117 149 L130 130Z"],
    ["shoulder-left-back", "左肩背", "M195 111 L217 119 L226 140 L203 149 L190 130Z"],
    ["upper-back-right", "右上背", "M128 112 L158 112 L158 184 L120 184 L118 146Z"],
    ["upper-back-left", "左上背", "M162 112 L192 112 L202 146 L200 184 L162 184Z"],
    ["lumbar-right", "右腰背", "M124 188 L158 188 L158 271 L125 271Z"],
    ["lumbar-left", "左腰背", "M162 188 L196 188 L195 271 L162 271Z"],
    ["arm-right-back", "右上肢背侧", "M92 145 L111 154 L85 226 L64 225Z"],
    ["arm-left-back", "左上肢背侧", "M228 145 L209 154 L235 226 L256 225Z"],
    ["hand-right-back", "右手背", "M63 228 L83 232 L76 252 Q66 265 57 248Z"],
    ["hand-left-back", "左手背", "M257 228 L237 232 L244 252 Q254 265 263 248Z"],
    ["thigh-right-back", "右大腿后侧", "M127 283 L156 288 L154 372 L122 371Z"],
    ["thigh-left-back", "左大腿后侧", "M193 283 L164 288 L166 372 L198 371Z"],
    ["calf-right-back", "右小腿后侧", "M123 375 L153 375 L147 460 L124 463Z"],
    ["calf-left-back", "左小腿后侧", "M197 375 L167 375 L173 460 L196 463Z"]
  ];
  function bodyMarkup(view, selected, interactive) {
    const shapes = (view === "front" ? zonesFront : zonesBack).map(function (z) {
      const key = view + ":" + z[0];
      const active = selected.has(key) || Array.from(selected.keys()).some(function (v) { return v.startsWith(key + "|"); });
      const accessible = interactive ? ' role="button" tabindex="0" data-zone="' + esc(key) + '" aria-pressed="' + active + '"' : "";
      return '<path class="body-zone' + (active ? ' selected' : '') + '" d="' + z[2] + '"' + accessible + '><title>' + esc(z[1]) + '</title></path>';
    }).join("");
    return '<g>' + silhouettes + shapes + '</g>' +
      '<text x="160" y="495" text-anchor="middle" class="zone-mini-label">示意图仅用于描述症状位置，并非器官诊断</text>';
  }
  function currentEvent() {
    return state.events.find(function (e) { return e.id === state.currentEventId; }) || state.events[0];
  }
  function eventById(id) { return state.events.find(function (e) { return e.id === id; }); }
  function fmt(dt) {
    if (!dt) return "时间未填写";
    const d = new Date(dt);
    return Number.isNaN(+d) ? esc(dt) : d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  }
  function dayFmt(dt) {
    if (!dt) return "未知日期";
    const d = new Date(dt);
    return Number.isNaN(+d) ? esc(dt) : d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
  }
  function currentLocal() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  let toastHandle;
  function notify(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastHandle); toastHandle = setTimeout(function () { el.classList.remove("show"); }, 2700);
  }
  function go(page) {
    if (!routes[page]) return;
    state.view = page;
    document.querySelectorAll(".screen").forEach(function (el) { el.classList.toggle("active", el.id === "screen-" + page); });
    document.querySelectorAll("[data-nav]").forEach(function (btn) { btn.classList.toggle("active", btn.dataset.nav === page); });
    $("crumb").textContent = routes[page][0];
    $("page-title").textContent = routes[page][1];
    $("page-subtitle").textContent = routes[page][2];
    if (page === "report") renderReport();
    if (page === "ai") renderQA();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const zoneDetails = {
    "front:head": ["前额", "头顶", "左太阳穴", "右太阳穴", "面部"],
    "front:neck": ["颈前正中", "左颈侧", "右颈侧"],
    "front:chest-right": ["右胸前", "右胸侧", "右胸骨旁"],
    "front:chest-left": ["左胸前", "左胸侧", "左胸骨旁"],
    "front:upper-abd": ["上腹正中", "左上腹", "右上腹"],
    "front:navel": ["脐周正中", "脐周左侧", "脐周右侧"],
    "front:lower-abd-left": ["左下腹靠近肚脐", "左下腹靠近髋部"],
    "front:lower-abd-right": ["右下腹靠近肚脐", "右下腹靠近髋部"],
    "back:head-back": ["后枕部", "左后脑", "右后脑"],
    "back:upper-back-left": ["左肩胛骨区", "左肩胛骨内侧"],
    "back:upper-back-right": ["右肩胛骨区", "右肩胛骨内侧"],
    "back:lumbar-left": ["左腰", "左侧腰背"],
    "back:lumbar-right": ["右腰", "右侧腰背"]
  };
  function zoneLabel(key) {
    const [view, id] = key.split(":");
    const z = (view === "back" ? zonesBack : zonesFront).find(function (v) { return v[0] === id; });
    return z ? z[1] : key;
  }
  function renderZoneDetail() {
    const target = $("zone-detail");
    const key = state.activeZone;
    if (!key) {
      target.innerHTML = '<strong>点击人体区域，选择更具体的位置</strong><p>可选整体区域，或点击二级细分区域；未标记位置也能记录。</p>'; return;
    }
    const label = zoneLabel(key), subs = zoneDetails[key] || [];
    target.innerHTML = '<strong>当前部位：' + esc(label) + '</strong><p>可直接使用整体区域；也可以选择一项或多项更细位置。</p>' +
      '<div class="detail-options"><button type="button" class="detail-chip' + (state.zones.has(key) ? ' selected' : '') +
      '" data-zone-detail="whole">整体：' + esc(label) + '</button>' +
      subs.map(function (part,i) {
        const id = key + "|" + i;
        return '<button type="button" class="detail-chip' + (state.zones.has(id) ? ' selected' : '') +
        '" data-zone-detail="' + i + '">' + esc(part) + '</button>';
      }).join("") + '</div>';
  }
  function renderRadiation() {
    const choices = Array.from(state.zones.entries());
    const opts = '<option value="">未选择</option>' + choices.map(function (pair) { return '<option value="' + esc(pair[0]) + '">' + esc(pair[1]) + '</option>'; }).join("");
    ["radiate-from","radiate-to"].forEach(function (name) {
      const el = $(name);
      const value = name === "radiate-from" ? state.radiationFrom : state.radiationTo;
      el.innerHTML = opts; el.value = state.zones.has(value) ? value : "";
    });
    if (!state.zones.has(state.radiationFrom)) state.radiationFrom = "";
    if (!state.zones.has(state.radiationTo)) state.radiationTo = "";
  }
  function renderBody() {
    $("body-svg").innerHTML = bodyMarkup(state.bodyView, state.zones, true);
    $("body-side").textContent = state.bodyView === "front" ? "正面视图" : "背面视图";
    $("switch-front").classList.toggle("active", state.bodyView === "front");
    $("switch-back").classList.toggle("active", state.bodyView === "back");
    const sel = Array.from(state.zones.entries());
    $("selected-areas").innerHTML = sel.length ? sel.map(function (pair) {
      return '<button type="button" class="area-tag" data-remove-zone="' + esc(pair[0]) + '">' + esc(pair[1]) + ' ×</button>';
    }).join("") : '<span class="muted">' + (state.unlocated ? "已选择：全身 / 不明确位置" : "尚未选择，可直接填写症状") + '</span>';
    $("unlocated").classList.toggle("active", state.unlocated);
    renderZoneDetail(); renderRadiation();
  }
  function renderChips() {
    document.querySelectorAll("#symptom-chips [data-symptom]").forEach(function (button) {
      button.classList.toggle("selected", state.symptoms.has(button.dataset.symptom));
      button.setAttribute("aria-pressed", String(state.symptoms.has(button.dataset.symptom)));
    });
  }
  function renderStats() {
    $("stat-events").textContent = state.events.length;
    $("stat-symptoms").textContent = state.events.reduce(function (n, e) { return n + e.entries.filter(function (x) { return x.kind === "symptom"; }).length; }, 0);
    $("stat-medication").textContent = state.events.reduce(function (n, e) { return n + e.entries.filter(function (x) { return x.kind === "med"; }).length; }, 0);
  }
  function renderHome() {
    $("home-events").innerHTML = state.events.slice().reverse().map(function (e) {
      return '<div class="event-preview" role="button" tabindex="0" data-event="' + esc(e.id) + '"><div class="event-preview-head"><h4>' + esc(e.title) + '</h4><span class="status-pill">' + esc(e.status) + '</span></div>' +
        '<p>' + e.entries.length + ' 条记录 · ' + e.entries.filter(function (x) { return x.kind === "med"; }).length + ' 条用药记录</p><small>开始于 ' + dayFmt(e.start) + '</small></div>';
    }).join("");
  }
  function populateEventSelects() {
    const options = state.events.map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(e.title) + '</option>'; }).join("");
    const r = $("target-event"), m = $("med-event"), p = $("report-event");
    const rv = r.value || "new";
    r.innerHTML = '<option value="new">＋ 新建健康事件</option>' + options;
    r.value = rv === "new" || eventById(rv) ? rv : "new";
    m.innerHTML = options; p.innerHTML = options;
    $("care-event").innerHTML = options;
    $("qa-event").innerHTML = options;
    m.value = state.currentEventId; p.value = state.currentEventId;
    $("care-event").value = state.currentEventId;
    $("qa-event").value = state.currentEventId;
    renderLinkedChoices();
  }
  const orderNames = { prescription:"处方 / 用药医嘱", treatment:"治疗建议",test:"检查建议",followup:"复诊 / 复查", lifestyle:"生活方式注意事项", other:"其他医嘱" };
  const executionNames = {unknown:"尚未确认", not_started:"未执行", in_progress:"执行中", completed:"用户报告已执行（需核对执行记录）"};
  function entryTitle(entry) {
    if (entry.kind === "visit") return "就医：" + (entry.hospital || "机构未记录") + (entry.department ? " · "+entry.department : "");
    if (entry.kind === "order") return "医生医嘱（转录）：" + (orderNames[entry.orderType] || "其他医嘱");
    if (entry.kind === "treatment") return "实际治疗：" + entry.name;
    if (entry.kind === "med") return "服用：" + entry.name + " · " + entry.dose + entry.unit;
    const types = (entry.symptoms || []).join("、") || "未分类症状";
    const area = (entry.zones || []).map(function (x) { return x.label; }).join("、") || (entry.unlocated ? "全身 / 位置不明" : "位置未注明");
    return area + " · " + types;
  }
  function entryDescription(entry) {
    if (entry.kind === "visit") return entry.notes || "就医信息由用户录入，需与原始医疗文书核对";
    if (entry.kind === "order") return (entry.text || "医嘱内容未填写") +
      (entry.items && entry.items.length ? " · 药品明细："+entry.items.map(function(x){return x.name;}).join("、") : "") +
      (entry.dueDate ? " · 计划日期："+entry.dueDate : "")+
      (entry.supersedes ? " · 替代了先前医嘱（保留历史）":"")+
      " · " + (entry.sourceType === "document" ? "用户根据文书转录，未验证原件" : "用户回忆，待核实") +
      " · " + (executionNames[entry.executionStatus] || "尚未确认");
    if (entry.kind === "treatment") return entry.details || "用户记录实际发生的治疗";
    if (entry.kind === "med") return (entry.notes || "实际用药记录（由用户确认）") + (entry.orderId ? " · 已关联处方记录" : " · 未关联处方") + (entry.itemId ? " · 已关联具体药品" : "");
    return (entry.severity == null ? "不适程度未评分" : "不适程度 " + entry.severity + "/10") +
      (entry.radiation ? " · 从" + entry.radiation.from + "延伸至" + entry.radiation.to : "") +
      (entry.notes ? " · " + entry.notes : "");
  }
  function renderEvents() {
    $("event-picker").innerHTML = state.events.slice().reverse().map(function (e) {
      return '<button type="button" class="event-choice' + (e.id === state.currentEventId ? ' selected' : '') + '" data-event="' + esc(e.id) + '"><strong>' + esc(e.title) + '</strong><small>' + dayFmt(e.start) + ' · ' + e.entries.length + ' 条记录 · ' + esc(e.status) + '</small></button>';
    }).join("");
    const e = currentEvent();
    if (!e) { $("event-detail").innerHTML = '<div class="empty">还没有健康事件</div>'; return; }
    const sorted = e.entries.slice().sort(function (a, b) { return new Date(a.when) - new Date(b.when); });
    const timeline = sorted.map(function (en) {
      const type = en.kind === "med" ? "实际用药" : en.kind === "visit" ? "就医" : en.kind === "order" ? "医嘱/处方" : en.kind === "treatment" ? "实际治疗" : "症状";
      return '<div class="timeline-item' + (en.kind === "med" ? ' med' : '') + '"><span class="timeline-dot"></span><small>' + fmt(en.when) + ' · ' + type + ' · 用户录入（未核实）</small><strong>' +
        esc(entryTitle(en)) + '</strong><p>' + esc(entryDescription(en)) + '</p></div>';
    }).join("");
    $("event-detail").innerHTML = '<div class="detail-top"><div><h3>' + esc(e.title) + '</h3><p>' + dayFmt(e.start) + ' 开始 · ' + e.entries.length + ' 条记录</p></div><span class="status-pill">' + esc(e.status) + '</span></div>' +
      '<div class="detail-actions"><button type="button" class="light-btn" data-nav="record">＋ 记录新症状</button><button type="button" class="light-btn" data-nav="medication">＋ 记录用药</button><button type="button" class="light-btn" data-nav="care">＋ 就医/医嘱/治疗</button><button type="button" class="light-btn" id="open-report">查看报告</button><button type="button" class="light-btn" id="toggle-event">' + (e.status === "进行中" ? "标记已结束" : "重新开启") + '</button></div>' +
      '<h3 style="font-size:15px;margin:25px 0 12px">事件时间线</h3><div class="timeline">' + (timeline || '<div class="empty">还没有记录</div>') + '</div>';
  }

  function selectOptions(entries, placeholder, caption) {
    return '<option value="">' + placeholder + '</option>' + entries.map(function (en) {
      return '<option value="' + esc(en.id) + '">' + esc(fmt(en.when) + " · " + caption(en)) + '</option>';
    }).join("");
  }

  // Each structured item is a transcription only, never a prescribing action.
  let rxCounter=0, photoUrl=null;
  function getRxItems(){
    return Array.from(document.querySelectorAll("#rx-items .rx-item")).map(function(row){
      const value=function(sel){return row.querySelector(sel).value.trim();};
      return {id:row.dataset.rxId,name:value(".rx-name"),strength:value(".rx-strength"),
        doseText:value(".rx-dose"),frequency:value(".rx-frequency"),duration:value(".rx-duration")};
    });
  }
  function renderRxItems(items){
    $("rx-items").innerHTML=items.map(function(item,i){
      const val=function(key){return esc(item[key]||"");};
      return '<div class="rx-item" data-rx-id="'+esc(item.id)+'">'+
        '<div class="rx-item-top"><strong>处方药品 '+(i+1)+'</strong><button type="button" class="light-btn" data-remove-rx="'+esc(item.id)+'">移除</button></div>'+
        '<label class="field-label">药品名称</label><input class="field-input rx-name" value="'+val("name")+'" placeholder="虚构药品名">'+
        '<div class="rx-grid">'+
        '<div><label class="field-label">规格原文</label><input class="field-input rx-strength" value="'+val("strength")+'" placeholder="可不填"></div>'+
        '<div><label class="field-label">单次用量原文</label><input class="field-input rx-dose" value="'+val("doseText")+'" placeholder="可不填"></div>'+
        '<div><label class="field-label">频次原文</label><input class="field-input rx-frequency" value="'+val("frequency")+'" placeholder="可不填"></div>'+
        '<div><label class="field-label">疗程原文</label><input class="field-input rx-duration" value="'+val("duration")+'" placeholder="可不填"></div></div></div>';
    }).join("");
  }
  function addRx(){
    const items=getRxItems();
    if(items.length>=5){notify("原型最多演示5项，正式版另行评估");return;}
    items.push({id:"rx-"+(++rxCounter),name:"",strength:"",doseText:"",frequency:"",duration:""});
    renderRxItems(items);
  }
  function showOrderFields(){
    $("rx-section").hidden=$("order-type").value!=="prescription";
    $("followup-field").hidden=$("order-type").value!=="followup";
  }
  function renderMedItems(){
    const e=eventById($("med-event").value)||currentEvent();
    const o=e && e.entries.find(function(a){return a.id===$("med-order").value&&a.kind==="order";});
    const items=o&&o.items||[];
    $("med-item-block").hidden=!items.length;
    $("med-item").innerHTML='<option value="">仅关联整张处方 / 不确定哪一项</option>'+
      items.map(function(item){return '<option value="'+esc(item.id)+'">'+esc(item.name)+'</option>';}).join("");
  }
  function showLocalPhoto(){
    if(photoUrl){URL.revokeObjectURL(photoUrl);photoUrl=null;}
    const f=$("order-photo").files[0],box=$("order-photo-preview");
    box.replaceChildren();
    if(!f){box.textContent="尚未选择图片；无 OCR，不上传、不保存。";return;}
    if(f.size>8*1024*1024 || !(f.type.startsWith("image/")||f.type==="application/pdf")){
      $("order-photo").value="";box.textContent="仅限 8MB 以下的图片/PDF 虚构测试文件。";return;
    }
    const p=document.createElement("p");p.textContent="仅本地预览："+f.name+"；不上传、不随记录保存、无 OCR。";box.appendChild(p);
    if(f.type.startsWith("image/")){
      photoUrl=URL.createObjectURL(f);
      const img=document.createElement("img");img.src=photoUrl;img.alt="本地虚构处方图片预览";box.appendChild(img);
    }
  }
  function clearLocalPhoto(){
    if(photoUrl){URL.revokeObjectURL(photoUrl);photoUrl=null;}
    $("order-photo").value="";$("order-photo-preview").textContent="未保存原件；可重新选择本地图片。";
  }
  function renderLinkedChoices() {
    const careEvent = eventById($("care-event").value) || currentEvent();
    const medEvent = eventById($("med-event").value) || currentEvent();
    if (careEvent) {
      $("order-visit").innerHTML = selectOptions(careEvent.entries.filter(function (e) { return e.kind === "visit"; }), "未关联具体就诊", function(e) {return e.hospital||"就医";});
      $("treatment-order").innerHTML = selectOptions(careEvent.entries.filter(function (e) { return e.kind === "order" && e.orderType === "treatment"; }), "未关联治疗医嘱", function(e) {return e.text || "治疗建议";});
      $("order-supersedes").innerHTML=selectOptions(careEvent.entries.filter(function(e){return e.kind==="order";}),"新增医嘱（不替代旧医嘱）",function(e){return e.text.slice(0,36);});
      $("visit-followup").innerHTML=selectOptions(careEvent.entries.filter(function(e){return e.kind==="order"&&e.orderType==="followup";}),"本次就诊未关联复诊计划",function(e){return e.text.slice(0,36);});
    }
    if (medEvent) {
      const previous=$("med-order").value;
      $("med-order").innerHTML=selectOptions(medEvent.entries.filter(function(e){return e.kind==="order"&&e.orderType==="prescription";}),"未关联 / 自行记录实际用药",function(e){return e.text || "处方";});
      if(medEvent.entries.some(function(e){return e.id===previous&&e.orderType==="prescription";}))$("med-order").value=previous;
      renderMedItems();
    }
  }

  function orderSnapshot(event){
    const orders=event.entries.filter(function(e){return e.kind==="order";});
    const superseded=new Set(orders.map(function(o){return o.supersedes;}).filter(Boolean));
    const meds=event.entries.filter(function(e){return e.kind==="med";});
    const treatments=event.entries.filter(function(e){return e.kind==="treatment";});
    const visits=event.entries.filter(function(e){return e.kind==="visit";});
    return {orders,superseded,meds,treatments,visits};
  }
  function renderOrderComparison(event){
    const d=orderSnapshot(event);
    if(!d.orders.length)return '<div class="empty">尚无医生医嘱（未记录不代表不存在）</div>';
    return '<p class="helper">以下仅统计明确关联的实际记录次数，不能据此判断是否遵医嘱或是否已经完成疗程。</p>'+
      d.orders.slice().sort(function(a,b){return new Date(b.when)-new Date(a.when);}).map(function(o){
        const old=d.superseded.has(o.id);
        const uses=d.meds.filter(function(m){return m.orderId===o.id;});
        const done=d.treatments.filter(function(t){return t.orderId===o.id;});
        const followed=d.visits.filter(function(v){return v.followupOrderId===o.id;});
        let linked='';
        if(o.orderType==="prescription"){
          const itemRows=(o.items||[]).map(function(item){
            const count=uses.filter(function(m){return m.itemId===item.id;}).length;
            return '<div class="compare-line"><span>'+esc(item.name||"未命名药品")+
              '</span><span>'+count+' 条已关联的实际用药记录</span></div>';
          }).join("");
          linked=itemRows+(uses.some(function(m){return !m.itemId;})?
            '<div class="compare-line"><span>未明确对应药品</span><span>'+uses.filter(function(m){return !m.itemId;}).length+' 条关联整方的记录</span></div>':'');
          if(!linked)linked='<p class="helper">暂无关联实际用药记录；不代表未服用。</p>';
        } else if(o.orderType==="treatment")linked='<p class="helper">关联的实际治疗记录：'+done.length+' 条；未记录不等于未治疗。</p>';
        else if(o.orderType==="followup")linked='<p class="helper">建议日期：'+esc(o.dueDate||"未填写")+
          ' · 关联的实际就诊记录：'+followed.length+' 条；未记录不代表未就诊。</p>';
        return '<div class="compare-card"><div class="compare-heading"><strong>'+esc(orderNames[o.orderType]||"医嘱")+
          '</strong><span class="status-pill">'+(old?"已有后续替代版本":"当前无后续替代记录")+'</span></div>'+
          '<p>'+esc(o.text||"原文未另填")+'</p>'+linked+'</div>';
      }).join("");
  }
  function renderFollowupPlan(event){
    const d=orderSnapshot(event);
    const plans=d.orders.filter(function(o){return o.orderType==="followup"&&!d.superseded.has(o.id);});
    if(!plans.length)return "";
    return '<div class="plan-list"><h4>复诊 / 复查计划（用户转录）</h4>'+
      plans.map(function(o){
        const done=d.visits.filter(function(v){return v.followupOrderId===o.id;});
        return '<div class="plan-item"><strong>'+esc(o.dueDate||"日期未明确")+'</strong><span>'+
          esc(o.text||"复诊/复查")+'</span><small>已关联实际就诊 '+done.length+' 次；未登记不代表未就诊</small></div>';
      }).join("")+'</div>';
  }
  function renderCare() {
    const event = eventById($("care-event").value) || currentEvent();
    if (!event) { $("care-list").innerHTML = '<div class="empty">请先创建健康事件</div>';return; }
    const care = event.entries.filter(function(en){return ["visit","order","treatment"].includes(en.kind);});
    care.sort(function(a,b){return new Date(b.when)-new Date(a.when);});
    $("order-comparison").innerHTML=renderOrderComparison(event);
    $("followup-overview").innerHTML=renderFollowupPlan(event);
    $("care-list").innerHTML = care.length ? care.map(function(en){
      const badge = en.kind === "visit" ? "就医" : en.kind === "order" ? "医嘱 / 处方" : "治疗执行";
      return '<div class="med-list-item"><span class="status-pill">'+badge+'</span><strong class="care-item-title">'+esc(entryTitle(en))+'</strong><p>'+
        esc(fmt(en.when))+'</p><p>'+esc(entryDescription(en))+'</p></div>';
    }).join(""):'<div class="empty">该事件还没有就医、医嘱或实际治疗记录</div>';
  }
  function selectCareTab(tab) {
    document.querySelectorAll("[data-care-tab]").forEach(function(btn){btn.classList.toggle("active",btn.dataset.careTab===tab);});
    document.querySelectorAll(".care-form").forEach(function(el){el.classList.toggle("active",el.id==="care-"+tab+"-form");});
  }
  function createCareEntry(entry) {
    const event=eventById($("care-event").value);
    if(!event){notify("请先建立健康事件");return false;}
    event.entries.push(entry);
    state.currentEventId=event.id;
    state.qaIndex=0;state.qaAnswers=[];
    renderEverything();
    $("care-event").value=event.id; renderLinkedChoices();renderCare();
    notify("记录已保存：医嘱与实际执行会分开展示");
    return true;
  }
  function saveVisit(){
    const when=$("visit-date").value || currentLocal(),hospital=$("visit-hospital").value.trim(),department=$("visit-dept").value.trim(),notes=$("visit-note").value.trim();
    if(!hospital && !department && !notes){notify("请至少填写医疗机构、科室或医生意见");return;}
    if(createCareEntry({id:"v-"+Date.now(),kind:"visit",when,hospital:hospital.slice(0,120),department:department.slice(0,120),notes:notes.slice(0,2000),sourceType:"self",followupOrderId:$("visit-followup").value})){
      $("visit-hospital").value="";$("visit-dept").value="";$("visit-note").value="";$("visit-followup").value="";
    }
  }
  function saveOrder(){
    const type=$("order-type").value,textValue=$("order-text").value.trim();
    const all=type==="prescription"?getRxItems():[];
    if(all.some(function(x){return !x.name&&(x.strength||x.doseText||x.frequency||x.duration);})){
      notify("处方明细存在缺少药名的条目，请核对或删除");return;
    }
    const items=all.filter(function(x){return x.name;}).map(function(x){
      return {id:x.id,name:x.name.slice(0,120),strength:x.strength.slice(0,100),
        doseText:x.doseText.slice(0,120),frequency:x.frequency.slice(0,120),duration:x.duration.slice(0,120)};
    });
    if(!textValue&&!items.length){notify("请输入医嘱原文或至少一项药品明细");return;}
    const supersedes=$("order-supersedes").value;
    const ev=eventById($("care-event").value);
    const old=ev&&ev.entries.find(function(x){return x.id===supersedes&&x.kind==="order";});
    if(supersedes&&(!old||old.orderType!==type)){notify("替代关系必须选择同类型旧医嘱");return;}
    const item={id:"o-"+Date.now(),kind:"order",when:$("order-time").value||currentLocal(),
      visitId:$("order-visit").value,orderType:type,text:textValue.slice(0,2500),
      items,dueDate:type==="followup"?$("order-due").value:"",
      supersedes:supersedes||null,sourceType:$("order-source").value,
      executionStatus:$("order-status").value};
    if(createCareEntry(item)){
      $("order-text").value="";$("order-visit").value="";
      $("order-status").value="unknown";$("order-supersedes").value="";$("order-due").value="";
      renderRxItems([]);addRx();clearLocalPhoto();
    }
  }
  function saveTreatment(){
    const name=$("treatment-name").value.trim();
    if(!name){notify("请填写实际进行的治疗项目");return;}
    if(createCareEntry({
      id:"t-"+Date.now(),kind:"treatment",when:$("treatment-time").value||currentLocal(),
      name:name.slice(0,200),details:$("treatment-detail").value.trim().slice(0,2000),orderId:$("treatment-order").value,sourceType:"self"
    })){$("treatment-name").value="";$("treatment-detail").value="";$("treatment-order").value="";}
  }
  function renderMedication() {
    const meds = [];
    state.events.forEach(function (e) { e.entries.forEach(function (en) { if (en.kind === "med") meds.push({ event: e, entry: en }); }); });
    meds.sort(function (a, b) { return new Date(b.entry.when) - new Date(a.entry.when); });
    $("medication-list").innerHTML = meds.length ? meds.map(function (item) {
      return '<div class="med-list-item"><strong>✚ ' + esc(item.entry.name) + '</strong><p>' + fmt(item.entry.when) + ' · ' + esc(item.entry.dose + " " + item.entry.unit) + '</p><p>关联事件：' + esc(item.event.title) + '</p><p>' + esc(item.entry.notes || "未记录服用后感受") + '</p></div>';
    }).join("") : '<div class="empty">还没有用药记录</div>';
  }
  function renderReport() {
    const id = $("report-event").value || state.currentEventId;
    const e = eventById(id); if (!e) return;
    const full = $("report-mode").value === "followup";
    const symptoms = e.entries.filter(function (x) { return x.kind === "symptom"; });
    const medication = e.entries.filter(function (x) { return x.kind === "med"; });
    const visits = e.entries.filter(function (x) { return x.kind === "visit"; });
    const orders = e.entries.filter(function (x) { return x.kind === "order"; });
    const treatments = e.entries.filter(function (x) { return x.kind === "treatment"; });
    const relevantEntries = e.entries.filter(function (x) { return full || x.kind === "med" || x.kind === "symptom"; });
    const allZones = Array.from(new Set(symptoms.flatMap(function(s) { return (s.zones || []).map(function(z) { return z.label; }); })));
    const selectedKeys = new Set(symptoms.flatMap(function (en) { return (en.zones || []).map(function(z) { return z.key; }); }));
    let bodyFigures = "";
    ["front","back"].forEach(function(view) {
      if(Array.from(selectedKeys).some(function(key){return key.indexOf(view+":")===0;})) {
        bodyFigures += '<div style="width:130px;text-align:center"><svg viewBox="0 0 320 500" style="height:170px;display:block;margin:auto" aria-label="' +
          (view==="front"?"正面":"背面")+'症状部位示意">'+bodyMarkup(view,selectedKeys,false)+'</svg><small>'+
          (view==="front"?"正面":"背面")+'</small></div>';
      }
    });
    const timeline = relevantEntries.slice().sort(function(a,b){return new Date(a.when)-new Date(b.when);}).map(function(en){
      return '<div class="timeline-row"><span>'+esc(fmt(en.when))+'</span><span><strong>'+esc(entryTitle(en))+
        '</strong>'+(entryDescription(en)?'<br>'+esc(entryDescription(en)):'')+'</span></div>';
    }).join("");
    const li = function(items,transform){
      return items.length ? '<ul>'+items.map(function(item){return '<li>'+transform(item)+'</li>';}).join("")+'</ul>' :
        '<p>暂无相应记录；未记录不代表未发生。</p>';
    };
    const comparisonHtml=renderOrderComparison(e),followupPlanHtml=renderFollowupPlan(e);
    const medicationHtml = li(medication,function(m){
      const linked = m.orderId ? orders.find(function(o){return o.id===m.orderId;}) : null;
      return '<strong>实际服用：</strong>'+esc(fmt(m.when)+' · '+m.name+' · '+m.dose+m.unit) +
        (linked ? '<br><small>关联处方（用户转录）：'+esc(linked.text)+'</small>':'<br><small>未关联处方 / 医嘱</small>')+
        (linked && m.itemId ? '<br><small>对应处方药品：'+esc(((linked.items||[]).find(function(x){return x.id===m.itemId;})||{}).name||"明细未找到")+'</small>':'');
    });
    const encountersHtml = li(visits,function(v){
      return '<strong>'+esc(fmt(v.when)+' · '+(v.hospital||"机构未记录"))+'</strong>'+
        '<br>'+esc(v.department||"科室未记录")+' · '+esc(v.notes||"未记录医师意见")+
        '<br><small>来源：用户转录，非已核验医疗机构记录</small>';
    });
    const orderHtml = li(orders,function(o){
      const visit = o.visitId && visits.find(function(v){return v.id===o.visitId;});
      const drugDetails=(o.items||[]).map(function(item){
        return '<li>'+esc(item.name)+' · 规格 '+esc(item.strength||"不明")+' · 单次用量 '+esc(item.doseText||"不明")+
          ' · 频次 '+esc(item.frequency||"不明")+' · 疗程 '+esc(item.duration||"不明")+'</li>';
      }).join("");
      const revision=o.supersedes?'<br><small>新版本：关联此前医嘱（保留旧记录）</small>':'';
      return '<strong>'+esc(fmt(o.when)+' · '+(orderNames[o.orderType]||"医嘱"))+'</strong><br>'+
        esc(o.text||"医嘱原文未另填")+(drugDetails?'<ul>'+drugDetails+'</ul>':'')+
        (o.dueDate?'<br><small>计划复诊/复查日期：'+esc(o.dueDate)+'</small>':'')+revision+
        '<br><small>状态：'+esc(executionNames[o.executionStatus]||"尚未确认")+
        '；来源：'+esc(o.sourceType==="document"?"依据文书手工转录，原件未核验":"用户回忆/转录，待核实")+
        (visit?'；关联就诊：'+esc(visit.hospital||"已关联"):'')+'</small>';
    });
    const treatmentHtml = li(treatments,function(t){
      const linked = t.orderId && orders.find(function(o){return o.id===t.orderId;});
      return '<strong>'+esc(fmt(t.when)+' · '+t.name)+'</strong><br>'+esc(t.details||"未记录实施细节")+
        '<br><small>实际执行情况：用户自述'+(linked?'；关联医嘱：'+esc(linked.text||"治疗医嘱"):'')+'</small>';
    });
    const aiSection = $("report-ai").checked ?
      '<section class="report-section"><h3>AI 功能说明（非医学建议）</h3><p>本原型未运行任何医学分析模型或危险信号分诊。正式产品中 AI 推断必须与事实分区、可追溯且经过医学安全验证。</p></section>' : "";
    const followup = full ?
      '<section class="report-section"><h3>就医及医疗机构信息（用户转录）</h3>'+encountersHtml+'</section>'+
      '<section class="report-section"><h3>医生开具的医嘱 / 处方（尚不代表执行）</h3>'+orderHtml+'</section>'+
      '<section class="report-section"><h3>复诊 / 复查计划与已关联就诊</h3>'+(followupPlanHtml||'<p>暂无复诊计划记录。</p>')+'</section>'+
      '<section class="report-section"><h3>医嘱与实际执行记录对照</h3>'+comparisonHtml+'</section>'+
      '<section class="report-section"><h3>实际治疗执行记录（用户自述）</h3>'+treatmentHtml+'</section>' : "";
    $("report-content").innerHTML =
      '<div class="report-title"><span class="eyebrow">HEALTH / VISIT SUMMARY</span><h2>'+
      (full?'就医与治疗全程档案':'就医前健康情况摘要')+'</h2><p>由本人记录生成 · 全部为演示数据 · 用于就医沟通流程测试</p></div>'+
      '<div class="report-meta"><span>事件：'+esc(e.title)+'</span><span>开始：'+dayFmt(e.start)+'</span><span>状态：'+esc(e.status)+'</span></div>'+
      '<section class="report-section"><h3>主要不适与部位</h3><p>'+
      (symptoms.length?esc(symptoms.map(function(x){return (x.symptoms||[]).join("、");}).filter(Boolean).join(" / ")||"未分类症状"):"暂无症状记录")+
      '</p><p>涉及部位：'+esc(allZones.join("、")||(symptoms.some(function(x){return x.unlocated;})?"全身 / 位置不明确":"位置未记录"))+
      '</p>'+(bodyFigures?'<div style="display:flex;gap:12px;justify-content:flex-start;flex-wrap:wrap">'+bodyFigures+'</div>':'')+'</section>'+
      '<section class="report-section"><h3>症状'+(full?'与就医处理':'与实际用药')+'时间线</h3>'+(timeline||'<p>暂无详细记录。</p>')+'</section>'+
      '<section class="report-section"><h3>实际用药（与处方分开）</h3>'+medicationHtml+'</section>'+followup+
      '<section class="report-section"><h3>供医生进一步核对的问题</h3><p>发作过程、既往相关经历、当前用药、医生医嘱的准确内容与后续治疗安排。未填写的信息不代表不存在。</p></section>'+
      aiSection+'<div class="report-foot">资料来源：用户自述与转录（虚构）。医生医嘱和处方需与原件核对；标记“已执行”不替代实际用药或治疗记录。不是诊断或急救建议。报告生成：'+esc(new Date().toLocaleString("zh-CN"))+'。</div>';
  }
  const commonQuestions = [
    {text:"这次不舒服是突然出现，还是逐渐开始的？",options:["突然开始","逐渐出现","说不清"]},
    {text:"这种不舒服是持续存在，还是一阵一阵出现？",options:["持续存在","间歇出现","不确定"]},
    {text:"与刚开始相比，目前的感觉有什么变化？",options:["更明显了","有所减轻","差不多","不清楚"]}
  ];
  // A deterministic UI demonstration, not clinical triage or model output.
  function questionsForEvent() {
    const e=eventById($("qa-event").value)||currentEvent();
    if(!e)return commonQuestions;
    const data=e.entries.filter(function(x){return x.kind==="symptom";});
    const zones=data.flatMap(function(en){return (en.zones||[]).map(function(z){return z.key;});});
    const symptoms=data.flatMap(function(en){return en.symptoms||[];});
    let prefix=[];
    if(zones.some(function(z){return /abd|navel/.test(z);})) {
      prefix=[{text:"这次腹部不适与进食时间有什么关系？",options:["饭前更明显","饭后更明显","暂未发现关系","不清楚"]}];
    } else if(zones.some(function(z){return /head|neck/.test(z);}) || symptoms.includes("头晕")) {
      prefix=[{text:"不适的主要位置是否发生过变化？",options:["位置比较固定","位置有变化","说不清"]}];
    } else if(zones.some(function(z){return /chest/.test(z);})) {
      prefix=[{text:"不适是否影响了你平时的活动？",options:["有影响","没有明显影响","不清楚"]}];
    } else if(zones.some(function(z){return /arm|hand|thigh|calf|shoulder|lumbar/.test(z);})) {
      prefix=[{text:"这些不适和身体活动有没有时间上的关联？",options:["活动时更明显","休息时更明显","暂未发现关系","不清楚"]}];
    }
    return prefix.concat(commonQuestions).slice(0,4);
  }
  function renderQA() {
    const panel=$("qa-panel"),questions=questionsForEvent();
    if(state.qaIndex>=questions.length) {
      panel.innerHTML='<div class="qa-finished"><h4>✓ 本次模拟补充问询已结束</h4><p>以下内容只用于演示如何收集病程信息，没有任何疾病分析或紧急程度判断。</p><ul>'+
        state.qaAnswers.map(function(a,i){return '<li>'+esc(questions[i].text+" "+a)+'</li>';}).join("")+
        '</ul><p><strong>正式产品限制：</strong>按症状引导问询的内容必须通过医学评审；紧急风险不能由大模型擅自判断或降级。</p>'+
        '<button type="button" class="btn btn-outline" id="restart-qa">重新体验</button></div>';return;
    }
    const q=questions[state.qaIndex];
    panel.innerHTML='<div class="qa-box"><small>问题 '+(state.qaIndex+1)+' / '+questions.length+' · 事件感知问询示例</small><h4>'+esc(q.text)+'</h4>'+
      '<div class="qa-choices">'+q.options.map(function(option){return '<button type="button" data-answer="'+esc(option)+'">'+esc(option)+'</button>';}).join("")+
      '</div></div><p class="form-footnote">根据事件的症状/部位选择预设问题，不调用 AI；支持“说不清”。</p>';
  }
  function renderEverything() {
    renderBody(); renderChips(); renderStats(); renderHome(); populateEventSelects();
    renderEvents(); renderMedication(); renderCare(); renderReport(); renderQA();
  }
  function saveSymptom() {
    const symptoms = Array.from(state.symptoms), zones = Array.from(state.zones.entries()).map(function (pair) { return { key: pair[0], label: pair[1] }; });
    const notes = $("symptom-notes").value.trim(), severity = $("severity-unknown").checked ? null : Number($("severity").value);
    const when = $("symptom-onset").value || currentLocal();
    const from = state.radiationFrom, to = state.radiationTo;
    if ((from || to) && (!from || !to || from === to || !state.zones.has(from) || !state.zones.has(to))) {
      notify("放射方向需选择两个不同且已标记的位置，或全部留空"); return;
    }
    if (!symptoms.length && !zones.length && !notes && !state.unlocated) { notify("请至少选择部位、症状，或填写补充说明"); return; }
    const target = $("target-event").value;
    let e = target === "new" ? null : eventById(target);
    if (!e) {
      const suggested = (zones[0] ? zones[0].label : "未明确部位") + (symptoms[0] || "不适");
      const name = window.prompt("为本次健康事件命名（可修改）", suggested);
      if (name === null) return;
      e = { id: "e-" + Date.now(), title: name.trim().slice(0, 60) || suggested, start: when, status: "进行中", entries: [] };
      state.events.push(e);
    }
    e.entries.push({ id: "s-" + Date.now(), kind: "symptom", when: when, zones: zones, unlocated: state.unlocated, symptoms: symptoms, severity: severity, notes: notes, radiation: from && to ? {from:state.zones.get(from),to:state.zones.get(to)} : null });
    state.currentEventId = e.id;
    state.qaIndex=0;state.qaAnswers=[];
    state.symptoms.clear(); state.zones.clear(); state.unlocated = false; state.activeZone=null;state.radiationFrom="";state.radiationTo="";
    $("symptom-notes").value = ""; $("severity").value = 5; $("severity-unknown").checked = true; $("severity").disabled = true; $("severity-value").textContent = "未评分";
    renderEverything(); notify("已保存症状，并关联到健康事件"); go("events");
  }
  function saveMedication() {
    const name = $("med-name").value.trim(), dose = $("med-dose").value.trim(), when = $("med-time").value || currentLocal();
    const event = eventById($("med-event").value);
    if (!name || !dose) { notify("请填写药名和实际服用量；无法确认请不要猜测"); return; }
    if (!event) { notify("请先新建健康事件，再记录本次用药"); return; }
    event.entries.push({ id: "m-" + Date.now(), kind: "med", when: when, name: name.slice(0, 120), dose: dose.slice(0, 60), unit: $("med-unit").value, notes: $("med-note").value.trim(),orderId:$("med-order").value,itemId:$("med-item").value });
    state.currentEventId = event.id;
    state.qaIndex=0;state.qaAnswers=[];
    $("med-name").value = ""; $("med-dose").value = ""; $("med-note").value = "";
    renderEverything(); notify("实际用药记录已关联到健康事件"); go("events");
  }
  function reportAsText() {
    const event = eventById($("report-event").value || state.currentEventId);
    if (!event) return "";
    const full = $("report-mode").value === "followup";
    const all = event.entries.filter(function(e){return full || e.kind==="symptom" || e.kind==="med";})
      .sort(function (a, b) { return new Date(a.when) - new Date(b.when); });
    return [full ? "就医与治疗全程档案（演示数据）" : "就医前健康情况摘要（演示数据）", "事件：" + event.title, "开始：" + dayFmt(event.start), "状态：" + event.status, "", "记录时间线:"]
      .concat(all.map(function (entry) { return fmt(entry.when) + " " + entryTitle(entry) + "；" + entryDescription(entry); }))
      .concat(["", "声明：资料来自用户自述/虚构演示数据，仅用于就医沟通，不构成诊断。"]).join("\n");
  }
  function bind() {
    document.addEventListener("click", function (event) {
      const nav = event.target.closest("[data-nav]");
      if (nav) { go(nav.dataset.nav); return; }
      const eventChoice = event.target.closest("[data-event]");
      if (eventChoice) { state.currentEventId = eventChoice.dataset.event; state.qaIndex=0;state.qaAnswers=[]; renderEverything(); go("events"); return; }
      const answer = event.target.closest("[data-answer]");
      if (answer) { state.qaAnswers.push(answer.dataset.answer); state.qaIndex++; renderQA(); return; }
      const remove = event.target.closest("[data-remove-zone]");
      if (remove) { state.zones.delete(remove.dataset.removeZone); renderBody(); return; }
      if (event.target.closest("#restart-qa")) { state.qaIndex = 0; state.qaAnswers = []; renderQA(); return; }
      if (event.target.closest("#toggle-event")) {
        const e = currentEvent(); if (e) e.status = e.status === "进行中" ? "已结束" : "进行中";
        renderEverything(); return;
      }
      if (event.target.closest("#open-report")) { renderEverything(); go("report"); }
    });
    $("body-svg").addEventListener("click", function (event) {
      const shape = event.target.closest("[data-zone]");
      if (!shape) return;
      const key = shape.dataset.zone;
      const label = shape.querySelector("title").textContent;
      state.activeZone = key;
      const matches = Array.from(state.zones.keys()).filter(function (v) { return v === key || v.startsWith(key + "|"); });
      if (matches.length) matches.forEach(function (v) { state.zones.delete(v); });
      else state.zones.set(key, label);
      state.unlocated = false;
      renderBody();
    });
    $("body-svg").addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        const shape = event.target.closest("[data-zone]");
        if (shape) { event.preventDefault(); shape.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
      }
    });
    $("switch-front").addEventListener("click", function () { state.bodyView = "front"; renderBody(); });
    $("switch-back").addEventListener("click", function () { state.bodyView = "back"; renderBody(); });
    $("zone-detail").addEventListener("click", function (event) {
      const btn = event.target.closest("[data-zone-detail]"); if (!btn || !state.activeZone) return;
      const base = state.activeZone, code = btn.dataset.zoneDetail;
      if (code === "whole") {
        Array.from(state.zones.keys()).filter(function (v) { return v.startsWith(base+"|"); }).forEach(function(v){state.zones.delete(v);});
        if (state.zones.has(base)) state.zones.delete(base); else state.zones.set(base, zoneLabel(base));
      } else {
        const key = base + "|" + code;
        const detail = (zoneDetails[base] || [])[Number(code)];
        if (!detail) return;
        state.zones.delete(base);
        if (state.zones.has(key)) state.zones.delete(key); else state.zones.set(key, detail);
      }
      state.unlocated = false; renderBody();
    });
    $("radiate-from").addEventListener("change", function(){state.radiationFrom=this.value;});
    $("radiate-to").addEventListener("change", function(){state.radiationTo=this.value;});
    $("clear-areas").addEventListener("click", function () { state.zones.clear(); state.activeZone=null; state.radiationFrom="";state.radiationTo=""; state.unlocated = false; renderBody(); });
    $("unlocated").addEventListener("click", function () { state.unlocated = !state.unlocated; if (state.unlocated) {state.zones.clear();state.radiationFrom="";state.radiationTo="";state.activeZone=null;} renderBody(); });
    $("symptom-chips").addEventListener("click", function (event) {
      const btn = event.target.closest("[data-symptom]"); if (!btn) return;
      if (state.symptoms.has(btn.dataset.symptom)) state.symptoms.delete(btn.dataset.symptom); else state.symptoms.add(btn.dataset.symptom);
      renderChips();
    });
    $("severity").addEventListener("input", function () { $("severity-value").textContent = this.value + " / 10"; });
    $("severity-unknown").addEventListener("change", function () { $("severity").disabled = this.checked; $("severity-value").textContent = this.checked ? "未评分" : $("severity").value + " / 10"; });
    $("save-symptom").addEventListener("click", saveSymptom);
    $("save-med").addEventListener("click", saveMedication);
    $("med-order").addEventListener("change",renderMedItems);
    $("order-type").addEventListener("change",showOrderFields);
    $("order-photo").addEventListener("change",showLocalPhoto);
    $("add-rx-item").addEventListener("click",addRx);
    $("rx-items").addEventListener("click",function(event){
      const btn=event.target.closest("[data-remove-rx]");if(!btn)return;
      renderRxItems(getRxItems().filter(function(x){return x.id!==btn.dataset.removeRx;}));
    });
    ["care-event","med-event"].forEach(function(id){$(id).addEventListener("change",function(){renderLinkedChoices();if(id==="care-event")renderCare();});});
    document.querySelectorAll("[data-care-tab]").forEach(function(btn){btn.addEventListener("click",function(){selectCareTab(btn.dataset.careTab);});});
    $("save-visit").addEventListener("click",saveVisit);
    $("save-order").addEventListener("click",saveOrder);
    $("save-treatment").addEventListener("click",saveTreatment);
    $("report-event").addEventListener("change", function () { state.currentEventId = this.value; state.qaIndex=0;state.qaAnswers=[]; renderReport(); });
    $("report-mode").addEventListener("change",renderReport);
    $("qa-event").addEventListener("change",function(){state.qaIndex=0;state.qaAnswers=[];renderQA();});
    $("report-ai").addEventListener("change", renderReport);
    $("print-report").addEventListener("click", function () { renderReport(); window.print(); });
    $("copy-report").addEventListener("click", async function () {
      try {
        await navigator.clipboard.writeText(reportAsText()); notify("报告文字已复制");
      } catch (e) { notify("当前浏览器无法直接复制，可选择打印 / 保存 PDF"); }
    });
    $("show-alert-demo").addEventListener("click", function () { $("emergency-modal").hidden = false; });
    $("close-modal").addEventListener("click", function () { $("emergency-modal").hidden = true; });
    $("emergency-modal").addEventListener("click", function (event) { if (event.target === this) this.hidden = true; });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") $("emergency-modal").hidden = true; });
  }
  function init() {
    $("symptom-onset").value = currentLocal();
    $("med-time").value = currentLocal();
    ["visit-date","order-time","treatment-time"].forEach(function(id){$(id).value=currentLocal();});
    addRx();showOrderFields();
    bind(); renderEverything(); go("home");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();