const STORAGE_KEY = "sports-dashboard-data-v2";
const LAYOUT_STORAGE_KEY = "sports-dashboard-layout-v1";

const defaultData = {
  views: {
    header: true,
    summary: true,
    tabs: true,
    year: true,
    bars: true,
    sessions: true,
  },
  header: {
    title: "运动记录",
    showHome: true,
    icons: { back: "←", home: "⌂", share: "⤴", more: "⋯" },
  },
  summaryCards: [
    { icon: "⚡", label: "总运动(分钟)", value: "124" },
    { icon: "🏃", label: "总跑步(公里)", value: "8.29" },
    { icon: "🏃", label: "户外跑步(公里)", value: "8.29" },
  ],
  activeSummaryIndex: 1,
  periodTabs: {
    labels: ["日", "周", "月", "年", "总"],
    selectedIndex: 3,
  },
  year: { value: 2026, suffix: "年", titleOverride: "" },
  primary: { label: "里程(公里)", value: "3.43" },
  secondaryMetrics: [
    { label: "消耗(千卡)", value: "350" },
    { label: "平均配速", value: "10'54\"" },
    { label: "时长", value: "00:37:27" },
    { label: "完成(次)", value: "2" },
  ],
  chartMode: "years",
  chart: {
    bars: [
      { label: "2024", value: 0 },
      { label: "2025", value: 2 },
      { label: "今年", value: 3.43, highlight: true },
    ],
    tooltipSuffix: " 公里",
  },
  monthlyDistance: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.2, 3.43],
  showSessionList: true,
  sessions: [
    {
      title: "户外跑步",
      line1: "0.23 公里",
      duration: "00:03:10",
      pace: "13'31\"",
      dateLabel: "4月2日",
    },
    {
      title: "户外跑步",
      line1: "3.43 公里",
      duration: "",
      pace: "",
      dateLabel: "3月31日",
    },
  ],
};

const defaultLayout = {
  order: ["header", "summary", "tabs", "year", "bars", "sessions"],
  margins: { header: 0, summary: 12, tabs: 12, year: 16, bars: 12, sessions: 12 },
  barsHeight: 160,
};

const form = document.getElementById("dataForm");
const resetBtn = document.getElementById("resetBtn");
const resetLayoutBtn = document.getElementById("resetLayoutBtn");
const saveStatus = document.getElementById("saveStatus");
const errorMsg = document.getElementById("errorMsg");
const phoneCard = document.getElementById("phoneCard");
const layoutStack = document.getElementById("layoutStack");
const layoutModeToggle = document.getElementById("layoutModeToggle");
const screenshotBtn = document.getElementById("screenshotBtn");
const chartInner = document.getElementById("chartInner");

let debounceTimer = null;
let layoutSaveTimer = null;
let statusHideTimer = null;
let syncingForm = false;

function normalizeMonthly(arr) {
  const out = Array.isArray(arr) ? arr.map((v) => Number(v) || 0) : [];
  while (out.length < 12) out.push(0);
  return out.slice(0, 12);
}

function mergeData(raw) {
  const d = structuredClone(defaultData);
  if (!raw || typeof raw !== "object") return d;
  if (raw.totals && !raw.summaryCards) return migrateFromV1(raw);
  d.views = { ...d.views, ...(raw.views || {}) };
  d.header = {
    ...d.header,
    ...raw.header,
    icons: { ...d.header.icons, ...(raw.header?.icons || {}) },
  };
  d.summaryCards = Array.isArray(raw.summaryCards) && raw.summaryCards.length
    ? raw.summaryCards.map((c, i) => ({ ...defaultData.summaryCards[i], ...c, value: String(c.value ?? "") }))
    : d.summaryCards;
  while (d.summaryCards.length < 3) d.summaryCards.push(structuredClone(defaultData.summaryCards[d.summaryCards.length]));
  d.summaryCards = d.summaryCards.slice(0, 3);
  d.activeSummaryIndex = Number.isFinite(raw.activeSummaryIndex) ? raw.activeSummaryIndex : d.activeSummaryIndex;
  d.periodTabs = {
    labels: Array.isArray(raw.periodTabs?.labels) && raw.periodTabs.labels.length === 5
      ? raw.periodTabs.labels.map(String)
      : d.periodTabs.labels,
    selectedIndex:
      typeof raw.periodTabs?.selectedIndex === "number" ? raw.periodTabs.selectedIndex : d.periodTabs.selectedIndex,
  };
  d.year = { ...d.year, ...raw.year };
  d.primary = { ...d.primary, ...raw.primary };
  d.secondaryMetrics = Array.isArray(raw.secondaryMetrics) && raw.secondaryMetrics.length === 4
    ? raw.secondaryMetrics.map((x, i) => ({
        label: String(x.label ?? defaultData.secondaryMetrics[i].label),
        value: String(x.value ?? ""),
      }))
    : d.secondaryMetrics;
  d.chartMode = raw.chartMode === "months" ? "months" : "years";
  const mergedBars =
    Array.isArray(raw.chart?.bars) && raw.chart.bars.length
      ? raw.chart.bars.map((b) => ({
          label: String(b.label ?? ""),
          value: Number(b.value) || 0,
          highlight: !!b.highlight,
        }))
      : structuredClone(defaultData.chart.bars);
  d.chart = {
    tooltipSuffix: raw.chart?.tooltipSuffix ?? defaultData.chart.tooltipSuffix,
    bars: mergedBars,
  };
  d.monthlyDistance = normalizeMonthly(raw.monthlyDistance);
  d.showSessionList = raw.showSessionList !== false;
  d.sessions = Array.isArray(raw.sessions)
    ? raw.sessions.map((s) => ({
        title: String(s.title ?? "运动"),
        line1: String(s.line1 ?? s.distanceText ?? ""),
        duration: String(s.duration ?? ""),
        pace: String(s.pace ?? ""),
        dateLabel: String(s.dateLabel ?? ""),
      }))
    : d.sessions;
  return d;
}

function migrateFromV1(raw) {
  const d = structuredClone(defaultData);
  d.year.value = raw.year ?? d.year.value;
  d.summaryCards[0].value = String(raw.totals?.totalMinutes ?? "");
  d.summaryCards[1].value = String(raw.totals?.totalDistance ?? "");
  d.summaryCards[2].value = String(raw.totals?.outdoorDistance ?? "");
  d.primary.value = String(raw.yearSummary?.distance ?? "");
  d.secondaryMetrics[0].value = String(raw.yearSummary?.calories ?? "");
  d.secondaryMetrics[1].value = String(raw.yearSummary?.pace ?? "");
  d.secondaryMetrics[2].value = String(raw.yearSummary?.duration ?? "");
  d.secondaryMetrics[3].value = String(raw.yearSummary?.sessions ?? "");
  d.monthlyDistance = normalizeMonthly(raw.monthlyDistance);
  const last = d.monthlyDistance[11] || d.primary.value;
  d.chart.bars = [
    { label: String(d.year.value - 2), value: 0 },
    { label: String(d.year.value - 1), value: 2 },
    { label: "今年", value: Number(last) || 3.43, highlight: true },
  ];
  return d;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadData() {
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) raw = localStorage.getItem("sports-dashboard-data-v1");
  if (!raw) return structuredClone(defaultData);
  try {
    return mergeData(JSON.parse(raw));
  } catch {
    return structuredClone(defaultData);
  }
}

function renderHeader(data) {
  const root = document.getElementById("headerRoot");
  const h = data.header;
  const icons = h.icons || defaultData.header.icons;
  const homeBtn = h.showHome
    ? `<button type="button" class="icon-btn" aria-label="主页">${escapeHtml(icons.home)}</button>`
    : "";
  root.innerHTML = `
    <div class="top-bar-left">
      <button type="button" class="icon-btn" aria-label="返回">${escapeHtml(icons.back)}</button>
      ${homeBtn}
    </div>
    <h1>${escapeHtml(h.title)}</h1>
    <div class="top-actions">
      <button type="button" class="icon-btn" aria-label="分享">${escapeHtml(icons.share)}</button>
      <button type="button" class="icon-btn" aria-label="更多">${escapeHtml(icons.more)}</button>
    </div>
  `;
}

function escapeHtml(s) {
  const t = document.createElement("div");
  t.textContent = s;
  return t.innerHTML;
}

function renderSummaryCards(data) {
  const root = document.getElementById("summaryCardsRoot");
  root.innerHTML = "";
  data.summaryCards.forEach((c, i) => {
    const art = document.createElement("article");
    art.className = "summary-card" + (i === data.activeSummaryIndex ? " active" : "");
    art.innerHTML = `
      <p class="summary-card-icon">${escapeHtml(c.icon || "")}</p>
      <p class="summary-card-label">${escapeHtml(c.label)}</p>
      <strong>${escapeHtml(String(c.value))}</strong>
    `;
    root.appendChild(art);
  });
}

function renderTabs(data) {
  const root = document.getElementById("tabsRoot");
  root.innerHTML = "";
  const labels = data.periodTabs.labels;
  const sel = data.periodTabs.selectedIndex;
  labels.forEach((label, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    if (i === sel) b.classList.add("active");
    root.appendChild(b);
  });
}

function renderYearTitle(data) {
  const el = document.getElementById("yearTitle");
  const y = data.year;
  if (y.titleOverride && String(y.titleOverride).trim()) {
    el.textContent = String(y.titleOverride).trim();
  } else {
    el.textContent = `${y.value}${y.suffix || "年"}`;
  }
}

function renderMiniMetrics(data) {
  const root = document.getElementById("miniMetricsRoot");
  root.innerHTML = "";
  data.secondaryMetrics.forEach((m) => {
    const div = document.createElement("div");
    div.innerHTML = `<p>${escapeHtml(m.label)}</p><strong>${escapeHtml(m.value)}</strong>`;
    root.appendChild(div);
  });
}

function renderPrimary(data) {
  document.getElementById("primaryMetricLabel").textContent = data.primary.label;
  document.getElementById("primaryMetricValue").textContent = data.primary.value;
}

function to2(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "0";
  return n.toFixed(2).replace(/\.00$/, "");
}

function renderChart(data) {
  chartInner.innerHTML = "";
  const mode = data.chartMode || "years";
  if (mode === "months") {
    const months = normalizeMonthly(data.monthlyDistance);
    const max = Math.max(...months, 1);
    const wrap = document.createElement("div");
    wrap.className = "chart-months";
    const barsRow = document.createElement("div");
    barsRow.className = "bars bars-months";
    months.forEach((num, idx) => {
      const h = (num / max) * 100;
      const div = document.createElement("div");
      div.className = "bar" + (idx === 11 ? " current" : "");
      div.style.height = `${Math.max(h, 4)}%`;
      if (num > 0) {
        const tag = document.createElement("span");
        tag.textContent = to2(num);
        div.appendChild(tag);
      }
      barsRow.appendChild(div);
    });
    const labels = document.createElement("div");
    labels.className = "chart-x-labels chart-x-labels-12";
    for (let i = 0; i < 12; i++) {
      const s = document.createElement("span");
      s.textContent = `${i + 1}`;
      labels.appendChild(s);
    }
    wrap.appendChild(barsRow);
    wrap.appendChild(labels);
    chartInner.appendChild(wrap);
    return;
  }

  const bars = (data.chart?.bars || []).filter((b) => b && String(b.label).trim() !== "");
  if (!bars.length) {
    chartInner.innerHTML = '<p class="chart-empty">请在右侧编辑图表各柱</p>';
    return;
  }

  let hi = bars.findIndex((b) => b.highlight);
  if (hi < 0) hi = bars.length - 1;

  const max = Math.max(...bars.map((b) => Number(b.value) || 0), 1);
  const suffix = data.chart?.tooltipSuffix ?? " 公里";

  const wrap = document.createElement("div");
  wrap.className = "chart-years";

  const area = document.createElement("div");
  area.className = "chart-area";

  const grid = document.createElement("div");
  grid.className = "chart-grid-lines";
  area.appendChild(grid);

  const barsRow = document.createElement("div");
  barsRow.className = "chart-bars-row";
  bars.forEach((b, idx) => {
    const num = Number(b.value) || 0;
    const pct = (num / max) * 100;
    const col = document.createElement("div");
    col.className = "chart-bar-col";
    const bar = document.createElement("div");
    bar.className = "bar chart-bar" + (idx === hi ? " current" : "");
    bar.style.height = `${Math.max(pct, 4)}%`;
    if (idx === hi) {
      const tip = document.createElement("div");
      tip.className = "chart-tooltip";
      tip.textContent = `${to2(num)}${suffix}`;
      col.appendChild(tip);
    }
    col.appendChild(bar);
    barsRow.appendChild(col);
  });
  area.appendChild(barsRow);

  const xlabels = document.createElement("div");
  xlabels.className = "chart-x-labels";
  bars.forEach((b) => {
    const s = document.createElement("span");
    s.textContent = b.label;
    xlabels.appendChild(s);
  });

  wrap.appendChild(area);
  wrap.appendChild(xlabels);
  chartInner.appendChild(wrap);
}

function renderSessions(data) {
  const root = document.getElementById("sessionsRoot");
  root.innerHTML = "";
  if (!data.showSessionList) {
    root.style.display = "none";
    return;
  }
  root.style.display = "";
  const list = (data.sessions || []).filter((s) => s && (s.title || s.line1 || s.dateLabel));
  if (!list.length) {
    const li = document.createElement("li");
    li.className = "session-item session-empty";
    li.textContent = "（暂无记录，可在右侧添加）";
    root.appendChild(li);
    return;
  }
  list.forEach((s) => {
    const li = document.createElement("li");
    li.className = "session-item";
    const titleLine = [s.title, s.line1].filter(Boolean).join(" ");
    const sub = [];
    if (s.duration) sub.push(`用时 ${s.duration}`);
    if (s.pace) sub.push(`配速 ${s.pace}`);
    li.innerHTML = `
      <div class="session-title">${escapeHtml(titleLine)}</div>
      ${sub.length ? `<div class="session-sub">${escapeHtml(sub.join("，"))}</div>` : ""}
      <div class="session-date">${escapeHtml(s.dateLabel)}</div>
    `;
    root.appendChild(li);
  });
}

function renderPreview(data) {
  applyViewVisibility(data);
  renderHeader(data);
  renderSummaryCards(data);
  renderTabs(data);
  renderYearTitle(data);
  renderPrimary(data);
  renderMiniMetrics(data);
  renderChart(data);
  renderSessions(data);
}

function applyViewVisibility(data) {
  const views = data.views || defaultData.views;
  Object.keys(defaultData.views).forEach((id) => {
    const block = layoutStack.querySelector(`[data-layout-id="${id}"]`);
    if (!block) return;
    block.style.display = views[id] === false ? "none" : "";
  });
}

function buildDynamicForm() {
  const sf = document.getElementById("summaryCardsForm");
  sf.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const row = document.createElement("div");
    row.className = "triple-row summary-card-form-row";
    row.innerHTML = `
      <span class="triple-label">卡片 ${i + 1}</span>
      <input type="text" name="summaryIcon_${i}" placeholder="图标" />
      <input type="text" name="summaryLabel_${i}" placeholder="标签" />
      <input type="text" name="summaryValue_${i}" placeholder="数值" />
      <label class="radio-inline"><input type="radio" name="activeSummaryIndex" value="${i}" /> 选中</label>
    `;
    sf.appendChild(row);
  }

  const tf = document.getElementById("periodTabsForm");
  tf.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const row = document.createElement("div");
    row.className = "form-row";
    row.innerHTML = `<label>标签 ${i + 1}</label><input type="text" name="tabLabel_${i}" />`;
    tf.appendChild(row);
  }
  const selRow = document.createElement("div");
  selRow.className = "form-row";
  selRow.innerHTML = `
    <label>当前选中</label>
    <select name="tabSelectedIndex">
      <option value="0">1</option><option value="1">2</option><option value="2">3</option>
      <option value="3">4</option><option value="4">5</option>
    </select>
  `;
  tf.appendChild(selRow);

  const mf = document.getElementById("secondaryMetricsForm");
  mf.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const row = document.createElement("div");
    row.className = "dual-row";
    row.innerHTML = `
      <span class="dual-label">格 ${i + 1}</span>
      <input type="text" name="secLabel_${i}" placeholder="标题" />
      <input type="text" name="secValue_${i}" placeholder="数值" />
    `;
    mf.appendChild(row);
  }

  const cf = document.getElementById("chartBarsForm");
  cf.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const row = document.createElement("div");
    row.className = "triple-row chart-bar-row";
    row.innerHTML = `
      <span class="triple-label">柱 ${i + 1}</span>
      <input type="text" name="chartLabel_${i}" placeholder="横轴标签" />
      <input type="number" name="chartValue_${i}" min="0" step="0.01" placeholder="数值" />
      <label class="radio-inline"><input type="radio" name="chartHighlightIndex" value="${i}" /> 高亮</label>
    `;
    cf.appendChild(row);
  }

  const sess = document.getElementById("sessionsForm");
  sess.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const row = document.createElement("div");
    row.className = "session-editor-block";
    row.innerHTML = `
      <div class="session-editor-title">记录 ${i + 1}</div>
      <div class="form-row"><label>标题</label><input type="text" name="sess_title_${i}" /></div>
      <div class="form-row"><label>副标题/距离</label><input type="text" name="sess_line1_${i}" placeholder="如 0.23 公里" /></div>
      <div class="form-row"><label>用时</label><input type="text" name="sess_duration_${i}" /></div>
      <div class="form-row"><label>配速</label><input type="text" name="sess_pace_${i}" /></div>
      <div class="form-row"><label>日期</label><input type="text" name="sess_date_${i}" /></div>
    `;
    sess.appendChild(row);
  }
}

function buildMonthInputs() {
  const monthsGrid = document.getElementById("monthsGrid");
  monthsGrid.innerHTML = "";
  const labels = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  labels.forEach((label, i) => {
    const cell = document.createElement("div");
    cell.className = "month-cell";
    const lab = document.createElement("label");
    lab.htmlFor = `month_${i}`;
    lab.textContent = label;
    const input = document.createElement("input");
    input.type = "number";
    input.name = `month_${i}`;
    input.id = `month_${i}`;
    input.min = "0";
    input.step = "0.01";
    input.placeholder = "0";
    cell.appendChild(lab);
    cell.appendChild(input);
    monthsGrid.appendChild(cell);
  });
}

function formToData() {
  const fd = new FormData(form);
  const activeSummaryEl = form.querySelector('input[name="activeSummaryIndex"]:checked');
  const activeSummaryIndex = activeSummaryEl ? Number(activeSummaryEl.value) : 0;
  const summaryCards = [];
  for (let i = 0; i < 3; i++) {
    summaryCards.push({
      icon: String(fd.get(`summaryIcon_${i}`) ?? ""),
      label: String(fd.get(`summaryLabel_${i}`) ?? ""),
      value: String(fd.get(`summaryValue_${i}`) ?? ""),
    });
  }
  const tabLabels = [];
  for (let i = 0; i < 5; i++) tabLabels.push(String(fd.get(`tabLabel_${i}`) ?? ""));
  const secondaryMetrics = [];
  for (let i = 0; i < 4; i++) {
    secondaryMetrics.push({
      label: String(fd.get(`secLabel_${i}`) ?? ""),
      value: String(fd.get(`secValue_${i}`) ?? ""),
    });
  }
  const hiEl = form.querySelector('input[name="chartHighlightIndex"]:checked');
  const hiIdx = hiEl ? Number(hiEl.value) : -1;
  const bars = [];
  for (let i = 0; i < 6; i++) {
    const label = String(fd.get(`chartLabel_${i}`) ?? "").trim();
    const val = fd.get(`chartValue_${i}`);
    if (label === "" && (val === "" || val === null)) continue;
    bars.push({
      label: label || `柱${i + 1}`,
      value: val === "" || val === null ? 0 : Number(val),
      highlight: hiIdx === i,
    });
  }
  const sessions = [];
  for (let i = 0; i < 8; i++) {
    const title = String(fd.get(`sess_title_${i}`) ?? "").trim();
    const line1 = String(fd.get(`sess_line1_${i}`) ?? "").trim();
    const duration = String(fd.get(`sess_duration_${i}`) ?? "").trim();
    const pace = String(fd.get(`sess_pace_${i}`) ?? "").trim();
    const dateLabel = String(fd.get(`sess_date_${i}`) ?? "").trim();
    if (!title && !line1 && !dateLabel) continue;
    sessions.push({ title, line1, duration, pace, dateLabel });
  }
  const months = [];
  for (let i = 0; i < 12; i++) {
    const v = fd.get(`month_${i}`);
    months.push(v === null || v === "" ? 0 : Number(v));
  }

  return {
    views: {
      header: fd.get("view_header") === "on",
      summary: fd.get("view_summary") === "on",
      tabs: fd.get("view_tabs") === "on",
      year: fd.get("view_year") === "on",
      bars: fd.get("view_bars") === "on",
      sessions: fd.get("view_sessions") === "on",
    },
    header: {
      title: String(fd.get("headerTitle") ?? "").trim() || defaultData.header.title,
      showHome: fd.get("headerShowHome") === "on",
      icons: {
        back: String(fd.get("iconBack") ?? "←"),
        home: String(fd.get("iconHome") ?? "⌂"),
        share: String(fd.get("iconShare") ?? "⤴"),
        more: String(fd.get("iconMore") ?? "⋯"),
      },
    },
    summaryCards,
    activeSummaryIndex: Math.min(2, Math.max(0, activeSummaryIndex)),
    periodTabs: {
      labels: tabLabels.map((l, i) => l || defaultData.periodTabs.labels[i]),
      selectedIndex: Math.min(4, Math.max(0, Number(fd.get("tabSelectedIndex")) || 0)),
    },
    year: {
      value: Number(fd.get("yearValue")) || defaultData.year.value,
      suffix: String(fd.get("yearSuffix") ?? "年"),
      titleOverride: String(fd.get("yearTitleOverride") ?? "").trim(),
    },
    primary: {
      label: String(fd.get("primaryLabel") ?? "").trim() || defaultData.primary.label,
      value: String(fd.get("primaryValue") ?? "").trim() || "0",
    },
    secondaryMetrics,
    chartMode: fd.get("chartMode") === "months" ? "months" : "years",
    chart: {
      bars,
      tooltipSuffix: String(fd.get("chartTooltipSuffix") ?? " 公里"),
    },
    monthlyDistance: normalizeMonthly(months),
    showSessionList: fd.get("showSessionList") === "on",
    sessions,
  };
}

function fillForm(data) {
  syncingForm = true;
  const v = { ...defaultData.views, ...(data.views || {}) };
  form.view_header.checked = v.header;
  form.view_summary.checked = v.summary;
  form.view_tabs.checked = v.tabs;
  form.view_year.checked = v.year;
  form.view_bars.checked = v.bars;
  form.view_sessions.checked = v.sessions;
  form.headerTitle.value = data.header.title;
  form.headerShowHome.checked = !!data.header.showHome;
  form.iconBack.value = data.header.icons.back;
  form.iconHome.value = data.header.icons.home;
  form.iconShare.value = data.header.icons.share;
  form.iconMore.value = data.header.icons.more;

  data.summaryCards.forEach((c, i) => {
    form[`summaryIcon_${i}`].value = c.icon;
    form[`summaryLabel_${i}`].value = c.label;
    form[`summaryValue_${i}`].value = c.value;
  });
  form.querySelectorAll('input[name="activeSummaryIndex"]').forEach((r) => {
    r.checked = Number(r.value) === data.activeSummaryIndex;
  });

  data.periodTabs.labels.forEach((l, i) => {
    form[`tabLabel_${i}`].value = l;
  });
  form.tabSelectedIndex.value = String(data.periodTabs.selectedIndex);

  form.yearValue.value = data.year.value;
  form.yearSuffix.value = data.year.suffix;
  form.yearTitleOverride.value = data.year.titleOverride || "";

  form.primaryLabel.value = data.primary.label;
  form.primaryValue.value = data.primary.value;

  data.secondaryMetrics.forEach((m, i) => {
    form[`secLabel_${i}`].value = m.label;
    form[`secValue_${i}`].value = m.value;
  });

  form.chartMode.value = data.chartMode;
  form.chartTooltipSuffix.value = data.chart.tooltipSuffix;

  for (let i = 0; i < 6; i++) {
    const b = data.chart.bars[i];
    form[`chartLabel_${i}`].value = b ? b.label : "";
    form[`chartValue_${i}`].value =
      b && b.value !== undefined && b.value !== "" && b.value !== null ? b.value : "";
  }
  const hiIdx = data.chart.bars.findIndex((b) => b.highlight);
  form.querySelectorAll('input[name="chartHighlightIndex"]').forEach((r) => {
    r.checked = hiIdx >= 0 && Number(r.value) === hiIdx;
  });

  const months = normalizeMonthly(data.monthlyDistance);
  for (let i = 0; i < 12; i++) {
    const inp = form.querySelector(`[name="month_${i}"]`);
    if (inp) inp.value = months[i] === 0 ? "" : months[i];
  }

  form.showSessionList.checked = data.showSessionList !== false;

  const sess = data.sessions || [];
  for (let i = 0; i < 8; i++) {
    const s = sess[i] || {};
    form[`sess_title_${i}`].value = s.title || "";
    form[`sess_line1_${i}`].value = s.line1 || "";
    form[`sess_duration_${i}`].value = s.duration || "";
    form[`sess_pace_${i}`].value = s.pace || "";
    form[`sess_date_${i}`].value = s.dateLabel || "";
  }

  syncChartEditorVisibility();
  syncingForm = false;
}

function validateData(obj) {
  if (!obj || typeof obj !== "object") throw new Error("数据无效");
  if (!obj.header || !obj.summaryCards) throw new Error("缺少必要字段");
}

function scheduleAutoSave() {
  if (syncingForm) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      const next = formToData();
      validateData(next);
      saveData(next);
      renderPreview(next);
      errorMsg.textContent = "";
      saveStatus.textContent = "已自动保存";
      clearTimeout(statusHideTimer);
      statusHideTimer = setTimeout(() => {
        saveStatus.textContent = "";
      }, 2000);
    } catch (e) {
      errorMsg.textContent = e.message || "保存失败";
      saveStatus.textContent = "";
    }
  }, 350);
}

function loadLayout() {
  const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
  const def = structuredClone(defaultLayout);
  if (!raw) return def;
  try {
    const p = JSON.parse(raw);
    const baseOrder = def.order;
    const order = Array.isArray(p.order) && p.order.length ? p.order : def.order;
    const valid = new Set(baseOrder);
    const filtered = order.filter((id) => valid.has(id));
    baseOrder.forEach((id) => {
      if (!filtered.includes(id)) filtered.push(id);
    });
    return {
      order: filtered,
      margins: { ...def.margins, ...(p.margins && typeof p.margins === "object" ? p.margins : {}) },
      barsHeight: typeof p.barsHeight === "number" ? p.barsHeight : def.barsHeight,
    };
  } catch {
    return structuredClone(defaultLayout);
  }
}

function saveLayout(layout) {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

function collectLayoutFromDOM() {
  const order = [...layoutStack.querySelectorAll(".layout-block")].map((b) => b.dataset.layoutId);
  const margins = { ...defaultLayout.margins };
  layoutStack.querySelectorAll(".layout-margin-input").forEach((inp) => {
    const key = inp.dataset.layoutKey;
    if (key) margins[key] = Number(inp.value) || 0;
  });
  const hInp = layoutStack.querySelector(".layout-bars-height-input");
  const barsHeight = hInp ? Number(hInp.value) || defaultLayout.barsHeight : defaultLayout.barsHeight;
  return { order, margins, barsHeight };
}

function applyLayout(layout) {
  const { order, margins, barsHeight } = layout;
  order.forEach((id) => {
    const node = layoutStack.querySelector(`[data-layout-id="${id}"]`);
    if (node) layoutStack.appendChild(node);
  });
  Object.keys(defaultLayout.margins).forEach((id) => {
    const block = layoutStack.querySelector(`[data-layout-id="${id}"]`);
    const v = margins[id] ?? defaultLayout.margins[id];
    if (block) block.style.marginTop = `${v}px`;
    const inp = layoutStack.querySelector(`.layout-margin-input[data-layout-key="${id}"]`);
    if (inp) {
      inp.value = String(v);
      const lab = inp.closest("label");
      const span = lab && lab.querySelector(".layout-margin-val");
      if (span) span.textContent = String(v);
    }
  });
  const h = barsHeight ?? defaultLayout.barsHeight;
  const chartWrap = document.getElementById("chartWrap");
  if (chartWrap) chartWrap.style.minHeight = `${h}px`;
  const hInp = layoutStack.querySelector(".layout-bars-height-input");
  if (hInp) {
    hInp.value = String(h);
    const lab = hInp.closest("label");
    const span = lab && lab.querySelector(".layout-bars-height-val");
    if (span) span.textContent = String(h);
  }
}

function scheduleLayoutSave() {
  clearTimeout(layoutSaveTimer);
  layoutSaveTimer = setTimeout(() => {
    saveLayout(collectLayoutFromDOM());
    saveStatus.textContent = "布局已保存";
    clearTimeout(statusHideTimer);
    statusHideTimer = setTimeout(() => {
      saveStatus.textContent = "";
    }, 1500);
  }, 200);
}

function setDragEnabled(on) {
  layoutStack.querySelectorAll(".layout-drag-handle").forEach((h) => {
    h.draggable = on;
  });
}

function initLayoutMode() {
  layoutModeToggle.addEventListener("click", () => {
    const on = !phoneCard.classList.contains("layout-edit-mode");
    phoneCard.classList.toggle("layout-edit-mode", on);
    layoutModeToggle.setAttribute("aria-pressed", on ? "true" : "false");
    layoutModeToggle.textContent = on ? "退出布局编辑" : "布局编辑";
    setDragEnabled(on);
  });

  let draggedId = null;

  layoutStack.addEventListener("dragstart", (e) => {
    if (!e.target.classList.contains("layout-drag-handle")) return;
    const block = e.target.closest(".layout-block");
    if (!block) return;
    draggedId = block.dataset.layoutId;
    e.dataTransfer.setData("text/plain", draggedId);
    e.dataTransfer.effectAllowed = "move";
    block.classList.add("dragging");
  });

  layoutStack.addEventListener("dragend", (e) => {
    if (!e.target.classList.contains("layout-drag-handle")) return;
    const block = e.target.closest(".layout-block");
    block?.classList.remove("dragging");
    layoutStack.querySelectorAll(".layout-block.drop-target").forEach((b) => b.classList.remove("drop-target"));
    draggedId = null;
  });

  layoutStack.addEventListener("dragover", (e) => {
    if (!draggedId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const target = e.target.closest(".layout-block");
    if (!target || target.dataset.layoutId === draggedId) return;
    layoutStack.querySelectorAll(".layout-block.drop-target").forEach((b) => b.classList.remove("drop-target"));
    target.classList.add("drop-target");
  });

  layoutStack.addEventListener("dragleave", (e) => {
    const target = e.target.closest(".layout-block");
    if (target && !target.contains(e.relatedTarget)) target.classList.remove("drop-target");
  });

  layoutStack.addEventListener("drop", (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggedId;
    const dragged = layoutStack.querySelector(`[data-layout-id="${id}"]`);
    const target = e.target.closest(".layout-block");
    layoutStack.querySelectorAll(".layout-block.drop-target").forEach((b) => b.classList.remove("drop-target"));
    if (!dragged || !target || dragged === target) return;
    const rect = target.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    if (before) layoutStack.insertBefore(dragged, target);
    else layoutStack.insertBefore(dragged, target.nextSibling);
    scheduleLayoutSave();
  });

  layoutStack.addEventListener("input", (e) => {
    const t = e.target;
    if (t.classList.contains("layout-margin-input")) {
      const block = t.closest(".layout-block");
      const lab = t.closest("label");
      const span = lab && lab.querySelector(".layout-margin-val");
      if (span) span.textContent = t.value;
      if (block) block.style.marginTop = `${t.value}px`;
      scheduleLayoutSave();
      return;
    }
    if (t.classList.contains("layout-bars-height-input")) {
      const lab = t.closest("label");
      const span = lab && lab.querySelector(".layout-bars-height-val");
      if (span) span.textContent = t.value;
      const chartWrap = document.getElementById("chartWrap");
      if (chartWrap) chartWrap.style.minHeight = `${t.value}px`;
      scheduleLayoutSave();
    }
  });

  resetLayoutBtn.addEventListener("click", () => {
    const L = structuredClone(defaultLayout);
    saveLayout(L);
    applyLayout(L);
    saveStatus.textContent = "布局已恢复默认";
    setTimeout(() => {
      saveStatus.textContent = "";
    }, 2000);
  });

  setDragEnabled(false);
}

function syncChartEditorVisibility() {
  const sel = form.chartMode;
  const barsForm = document.getElementById("chartBarsForm");
  const monthsGridEl = document.getElementById("monthsGrid");
  const hint = document.querySelector(".chart-months-hint");
  const m = sel && sel.value === "months";
  if (barsForm) barsForm.style.display = m ? "none" : "block";
  if (monthsGridEl) monthsGridEl.style.display = m ? "grid" : "none";
  if (hint) hint.style.display = m ? "block" : "none";
}

function bindChartModeUi() {
  form.chartMode.addEventListener("change", syncChartEditorVisibility);
  syncChartEditorVisibility();
}

function screenshotFileName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `运动记录_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.png`;
}

function initScreenshotDownload() {
  if (!screenshotBtn) return;
  screenshotBtn.addEventListener("click", async () => {
    if (typeof html2canvas !== "function") {
      errorMsg.textContent = "截图库未加载，请检查网络后刷新页面。";
      return;
    }
    const wasEdit = phoneCard.classList.contains("layout-edit-mode");
    screenshotBtn.disabled = true;
    const prevLabel = screenshotBtn.textContent;
    screenshotBtn.textContent = "生成中…";
    phoneCard.classList.add("screenshot-prep");
    if (wasEdit) phoneCard.classList.remove("layout-edit-mode");
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const canvas = await html2canvas(phoneCard, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("无法生成图片"));
              return;
            }
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = screenshotFileName();
            a.click();
            URL.revokeObjectURL(a.href);
            resolve();
          },
          "image/png",
          1
        );
      });
      errorMsg.textContent = "";
      saveStatus.textContent = "截图已下载";
      clearTimeout(statusHideTimer);
      statusHideTimer = setTimeout(() => {
        saveStatus.textContent = "";
      }, 2000);
    } catch (e) {
      errorMsg.textContent = e.message || "截图失败";
    } finally {
      phoneCard.classList.remove("screenshot-prep");
      if (wasEdit) {
        phoneCard.classList.add("layout-edit-mode");
        setDragEnabled(true);
      }
      screenshotBtn.disabled = false;
      screenshotBtn.textContent = prevLabel;
    }
  });
}

function wireYearNav() {
  document.getElementById("layoutStack").addEventListener("click", (e) => {
    const btn = e.target.closest(".year-nav");
    if (!btn) return;
    const dir = btn.getAttribute("aria-label") === "上一年" ? -1 : 1;
    const next = formToData();
    next.year.value += dir;
    syncingForm = true;
    form.yearValue.value = next.year.value;
    syncingForm = false;
    saveData(next);
    renderPreview(next);
    saveStatus.textContent = "已自动保存";
    clearTimeout(statusHideTimer);
    statusHideTimer = setTimeout(() => {
      saveStatus.textContent = "";
    }, 1500);
  });
}

buildDynamicForm();
buildMonthInputs();
applyLayout(loadLayout());
initLayoutMode();
initScreenshotDownload();
wireYearNav();

let currentData = loadData();
fillForm(currentData);
renderPreview(currentData);
bindChartModeUi();

form.addEventListener("input", scheduleAutoSave);
form.addEventListener("change", scheduleAutoSave);

resetBtn.addEventListener("click", () => {
  currentData = structuredClone(defaultData);
  saveData(currentData);
  fillForm(currentData);
  renderPreview(currentData);
  errorMsg.textContent = "";
  saveStatus.textContent = "已恢复默认并保存";
  setTimeout(() => {
    saveStatus.textContent = "";
  }, 2000);
});
