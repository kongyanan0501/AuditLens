/**
 * AuditLens 作品说明材料 PPT — 按参赛要求组织：
 * 作品名称、适用场景、主要功能、使用工具、数据来源、预期价值、推广可能
 */
const pptxgen = require("pptxgenjs");
const path = require("path");

const OUT = path.join(__dirname, "..", "AuditLens-演讲PPT.pptx");
const TOTAL = 10;

const C = {
  navy: "1E3A8A",
  navyDeep: "0F1B3D",
  ice: "E8EEF9",
  white: "FFFFFF",
  slate: "334155",
  muted: "64748B",
  light: "F8FAFC",
  card: "EEF2FF",
  success: "15803D",
  warning: "D97706",
};

function shadowSoft() {
  return {
    type: "outer",
    color: "0F172A",
    blur: 8,
    offset: 2,
    opacity: 0.12,
  };
}

function addFooter(slide, page) {
  slide.addText("AuditLens AI · 作品说明材料", {
    x: 0.5,
    y: 5.28,
    w: 6,
    h: 0.25,
    fontSize: 10,
    fontFace: "Arial",
    color: C.muted,
    margin: 0,
  });
  slide.addText(`${page} / ${TOTAL}`, {
    x: 8.5,
    y: 5.28,
    w: 1,
    h: 0.25,
    fontSize: 10,
    fontFace: "Arial",
    color: C.muted,
    align: "right",
    margin: 0,
  });
}

function addSlideTitle(slide, title, subtitle) {
  slide.addText(title, {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.48,
    fontSize: 28,
    fontFace: "Arial",
    bold: true,
    color: C.navyDeep,
    margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: 0.88,
      w: 9,
      h: 0.3,
      fontSize: 13,
      fontFace: "Arial",
      color: C.muted,
      margin: 0,
    });
  }
}

function lightBg(slide, pres) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    fill: { color: C.light },
  });
}

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "AuditLens";
pres.title = "AuditLens AI — 作品说明材料";
pres.subject = "参赛作品说明：名称、场景、功能、工具、数据、价值与推广";

// ─── 1. 封面：作品名称 ───────────────────────────────────
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    fill: { color: C.navyDeep },
  });
  s.addText("作品说明材料", {
    x: 0.7,
    y: 1.15,
    w: 8.5,
    h: 0.35,
    fontSize: 14,
    fontFace: "Arial",
    color: "94A3B8",
    margin: 0,
  });
  s.addText("AuditLens AI", {
    x: 0.7,
    y: 1.65,
    w: 8.5,
    h: 0.7,
    fontSize: 44,
    fontFace: "Arial",
    bold: true,
    color: C.white,
    margin: 0,
  });
  s.addText("智能财务风险审计工作台", {
    x: 0.7,
    y: 2.4,
    w: 8.5,
    h: 0.4,
    fontSize: 22,
    fontFace: "Arial",
    color: C.ice,
    margin: 0,
  });
  s.addText(
    "上传财务流水 → 规则检测与异常发现 → AI 制度解释 → 整改闭环 → 可归档底稿",
    {
      x: 0.7,
      y: 3.1,
      w: 8.5,
      h: 0.4,
      fontSize: 13,
      fontFace: "Arial",
      color: "94A3B8",
      margin: 0,
    },
  );
  s.addText("面向企业内审与财务合规  ·  可演示、可闭环、可演进", {
    x: 0.7,
    y: 4.35,
    w: 8.5,
    h: 0.3,
    fontSize: 12,
    fontFace: "Arial",
    color: "64748B",
    margin: 0,
  });
  s.addText("CBS  ·  0100  ·  Yana Kong", {
    x: 0.7,
    y: 4.9,
    w: 8.5,
    h: 0.3,
    fontSize: 12,
    fontFace: "Arial",
    color: "64748B",
    margin: 0,
  });
  s.addNotes(
    "各位评委好。我是 Yana Kong。今天介绍的作品是 AuditLens AI——智能财务风险审计工作台。一句话：上传财务流水，几分钟内完成规则检测与异常发现，用 AI 结合制度做解释，并进入整改闭环，最后留下可归档底稿。",
  );
}

// ─── 2. 说明目录 ─────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s, pres);
  addSlideTitle(s, "说明材料目录", "参赛说明七项 + 使用方法简介");

  const items = [
    { n: "01", t: "作品名称", d: "定位与一句话价值" },
    { n: "02", t: "适用场景", d: "谁用、何时用、解决什么" },
    { n: "03", t: "主要功能", d: "发现 → 解释 → 闭环" },
    { n: "04", t: "使用方法", d: "上传 → 复核 → 整改" },
    { n: "05", t: "使用工具", d: "技术栈与工程边界" },
    { n: "06", t: "数据来源", d: "输入样例与制度知识" },
    { n: "07", t: "预期价值", d: "效率、证据、合规沉淀" },
    { n: "08", t: "推广可能", d: "落地路径与扩展方向" },
  ];
  items.forEach((it, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.5 + col * 2.35;
    const y = 1.45 + row * 1.7;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x,
      y,
      w: 2.2,
      h: 1.45,
      fill: { color: C.white },
      shadow: shadowSoft(),
      rectRadius: 0.1,
    });
    s.addText(it.n, {
      x: x + 0.15,
      y: y + 0.22,
      w: 1.9,
      h: 0.3,
      fontSize: 14,
      fontFace: "Arial",
      bold: true,
      color: C.navy,
      margin: 0,
    });
    s.addText(it.t, {
      x: x + 0.15,
      y: y + 0.55,
      w: 1.9,
      h: 0.32,
      fontSize: 15,
      fontFace: "Arial",
      bold: true,
      color: C.navyDeep,
      margin: 0,
    });
    s.addText(it.d, {
      x: x + 0.15,
      y: y + 0.95,
      w: 1.9,
      h: 0.3,
      fontSize: 11,
      fontFace: "Arial",
      color: C.muted,
      margin: 0,
    });
  });
  addFooter(s, 2);
  s.addNotes(
    "说明材料按参赛要求组织：作品名称、适用场景、主要功能、使用工具、数据来源、预期价值、推广可能；另外补充一页使用方法，方便评委快速理解怎么用。",
  );
}

// ─── 3. 作品名称 ─────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s, pres);
  addSlideTitle(s, "作品名称", "AuditLens AI — 智能财务风险审计工作台");

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5,
    y: 1.4,
    w: 9,
    h: 1.35,
    fill: { color: C.white },
    shadow: shadowSoft(),
    rectRadius: 0.1,
  });
  s.addText("一句话定位", {
    x: 0.75,
    y: 1.55,
    w: 8.5,
    h: 0.3,
    fontSize: 12,
    fontFace: "Arial",
    bold: true,
    color: C.navy,
    margin: 0,
  });
  s.addText(
    "面向企业内审与财务合规：上传财务流水，几分钟内完成规则检测、异常发现与风险评分，并带着证据与制度依据进入整改闭环。",
    {
      x: 0.75,
      y: 1.95,
      w: 8.5,
      h: 0.55,
      fontSize: 14,
      fontFace: "Arial",
      color: C.slate,
      margin: 0,
    },
  );

  const pillars = [
    { t: "不是 Chat 套壳", d: "规则与评分可复现，AI 只做制度增强解释" },
    { t: "不是只出报告", d: "从发现到整改验收形成完整工作闭环" },
    { t: "不是空中楼阁", d: "证据链、角色权限、底稿元数据对准内审实操" },
  ];
  pillars.forEach((p, i) => {
    const x = 0.5 + i * 3.1;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x,
      y: 3.05,
      w: 2.95,
      h: 1.85,
      fill: { color: C.white },
      shadow: shadowSoft(),
      rectRadius: 0.1,
    });
    s.addText(p.t, {
      x: x + 0.18,
      y: 3.3,
      w: 2.6,
      h: 0.45,
      fontSize: 15,
      fontFace: "Arial",
      bold: true,
      color: C.navyDeep,
      margin: 0,
    });
    s.addText(p.d, {
      x: x + 0.18,
      y: 3.9,
      w: 2.6,
      h: 0.7,
      fontSize: 12,
      fontFace: "Arial",
      color: C.muted,
      margin: 0,
    });
  });
  addFooter(s, 3);
  s.addNotes(
    "AuditLens AI 面向企业内审与财务合规。我们强调三件事：不是 Chat 套壳——规则与评分可复现，AI 只做制度增强解释；不是只出报告——从发现到整改验收形成闭环；不是空中楼阁——证据链、角色权限、底稿元数据对准内审实操。",
  );
}

// ─── 4. 适用场景 ─────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s, pres);
  addSlideTitle(s, "适用场景", "企业内可用的最小审计工作台，先闭环再平台化");

  const users = [
    {
      role: "审计人员",
      when: "周期抽检 / 专项核查",
      need: "全量风险扫描、确认/误报、分派整改、验收关单",
    },
    {
      role: "业务对接人",
      when: "收到整改分派后",
      need: "仅看自己的工单，提交说明与附件，等待审计验收",
    },
    {
      role: "管理层",
      when: "结果汇报与决策",
      need: "Executive Brief：评分、高风险数、优先整改 Top3",
    },
  ];
  users.forEach((u, i) => {
    const y = 1.35 + i * 1.15;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.5,
      y,
      w: 9,
      h: 1.05,
      fill: { color: C.white },
      shadow: shadowSoft(),
      rectRadius: 0.08,
    });
    s.addText(u.role, {
      x: 0.75,
      y: y + 0.18,
      w: 2.2,
      h: 0.35,
      fontSize: 16,
      fontFace: "Arial",
      bold: true,
      color: C.navyDeep,
      margin: 0,
    });
    s.addText(u.when, {
      x: 3.1,
      y: y + 0.18,
      w: 6.1,
      h: 0.3,
      fontSize: 12,
      fontFace: "Arial",
      color: C.navy,
      margin: 0,
    });
    s.addText(u.need, {
      x: 0.75,
      y: y + 0.55,
      w: 8.5,
      h: 0.35,
      fontSize: 13,
      fontFace: "Arial",
      color: C.slate,
      margin: 0,
    });
  });
  addFooter(s, 4);
  s.addNotes(
    "三类用户：审计人员做全量扫描、确认或误报、分派整改、验收关单；业务对接人只看自己的工单，提交说明与附件；管理层看 Executive Brief——评分、高风险数、优先整改 Top3。我们先做企业内可用、能演示、能闭环的最小工作台。",
  );
}

// ─── 5. 主要功能 ─────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s, pres);
  addSlideTitle(s, "主要功能", "发现 → 解释 → 分派 → 整改验收 → 可导出底稿");

  const feats = [
    {
      t: "六节点审计流水线",
      d: "Parse → Rule → Anomaly → Score → RAG → Report，固定编排可复现",
    },
    {
      t: "规则 + 异常检测",
      d: "重复发票、审批缺失；金额离群、供应商集中；阈值可配置、结果可追溯",
    },
    {
      t: "制度增强解释",
      d: "RAG 检索本公司制度条款，LLM 只解释「为何可疑」，不替代判责",
    },
    {
      t: "Issue 工作台",
      d: "严重度/类型筛选，证据快照展开即见关联流水",
    },
    {
      t: "工单闭环与角色",
      d: "待复核→确认/误报→整改中→待验收→关闭；审计与业务 RLS 隔离",
    },
    {
      t: "正式报告导出",
      d: "执行摘要、发现项、风险分析、整改建议；可下载/复制/打印",
    },
  ];
  feats.forEach((f, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.5 + col * 3.1;
    const y = 1.4 + row * 1.7;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x,
      y,
      w: 2.95,
      h: 1.5,
      fill: { color: C.white },
      shadow: shadowSoft(),
      rectRadius: 0.1,
    });
    s.addText(f.t, {
      x: x + 0.18,
      y: y + 0.22,
      w: 2.6,
      h: 0.4,
      fontSize: 14,
      fontFace: "Arial",
      bold: true,
      color: C.navyDeep,
      margin: 0,
    });
    s.addText(f.d, {
      x: x + 0.18,
      y: y + 0.7,
      w: 2.6,
      h: 0.6,
      fontSize: 12,
      fontFace: "Arial",
      color: C.muted,
      margin: 0,
    });
  });
  addFooter(s, 5);
  s.addNotes(
    "六块核心能力：六节点流水线、规则与异常检测、制度增强解释、Issue 工作台、工单闭环与角色隔离、正式报告导出。关键原则：规则判风险，LLM 只解释。",
  );
}

// ─── 6. 使用方法 ─────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s, pres);
  addSlideTitle(s, "使用方法", "五步走完：上传 → 看风险 → 复核分派 → 整改验收 → 导出底稿");

  const steps = [
    { n: "1", t: "登录上传", d: "登录后上传 Excel / CSV 财务流水（可用演示样例）" },
    { n: "2", t: "自动审计", d: "系统跑通六节点流水线，跳转 Dashboard 查看风险总览" },
    { n: "3", t: "复核证据", d: "展开高风险 Issue，查看关联凭证、规则命中与制度解释" },
    { n: "4", t: "分派整改", d: "确认风险后分派业务；业务提交说明与附件，待审计验收" },
    { n: "5", t: "导出报告", d: "验收关闭后导出正式报告，作为可归档底稿带走" },
  ];
  steps.forEach((st, i) => {
    const y = 1.35 + i * 0.7;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.5,
      y,
      w: 9,
      h: 0.62,
      fill: { color: C.white },
      shadow: shadowSoft(),
      rectRadius: 0.06,
    });
    s.addShape(pres.shapes.OVAL, {
      x: 0.7,
      y: y + 0.11,
      w: 0.4,
      h: 0.4,
      fill: { color: C.navy },
    });
    s.addText(st.n, {
      x: 0.7,
      y: y + 0.15,
      w: 0.4,
      h: 0.32,
      fontSize: 14,
      fontFace: "Arial",
      bold: true,
      color: C.white,
      align: "center",
      margin: 0,
    });
    s.addText(st.t, {
      x: 1.3,
      y: y + 0.14,
      w: 1.8,
      h: 0.34,
      fontSize: 14,
      fontFace: "Arial",
      bold: true,
      color: C.navyDeep,
      margin: 0,
    });
    s.addText(st.d, {
      x: 3.2,
      y: y + 0.14,
      w: 6.1,
      h: 0.34,
      fontSize: 13,
      fontFace: "Arial",
      color: C.slate,
      margin: 0,
    });
  });
  addFooter(s, 6);
  s.addNotes(
    "使用五步：一登录上传 Excel 或 CSV；二自动审计后看 Dashboard；三展开高风险项复核证据与制度解释；四确认后分派业务整改，业务提交、审计验收；五导出正式报告作为底稿。现场 Demo 前三步约两分钟可走完。",
  );
}

// ─── 7. 使用工具 ─────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s, pres);
  addSlideTitle(s, "使用工具", "全栈可演进骨架 · 可插拔 AI · 明确依赖边界");

  const tools = [
    { layer: "前端 / API", items: "Next.js App Router、TypeScript、React" },
    { layer: "编排引擎", items: "LangGraph 六节点固定流水线" },
    { layer: "数据与鉴权", items: "Supabase Postgres、Auth、RLS" },
    { layer: "规则与评分", items: "自研规则引擎 + 异常检测 + RiskScoring" },
    { layer: "AI 能力", items: "可插拔 LLM（OpenAI / 通义等）+ 向量库（Pinecone）" },
    { layer: "工程约束", items: "app → server → lib；Key 仅服务端；无 Key 可降级演示" },
  ];
  tools.forEach((t, i) => {
    const y = 1.35 + i * 0.58;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.5,
      y,
      w: 9,
      h: 0.52,
      fill: { color: C.white },
      shadow: shadowSoft(),
      rectRadius: 0.06,
    });
    s.addText(t.layer, {
      x: 0.7,
      y: y + 0.1,
      w: 2.3,
      h: 0.32,
      fontSize: 13,
      fontFace: "Arial",
      bold: true,
      color: C.navy,
      margin: 0,
    });
    s.addText(t.items, {
      x: 3.1,
      y: y + 0.1,
      w: 6.2,
      h: 0.32,
      fontSize: 13,
      fontFace: "Arial",
      color: C.slate,
      margin: 0,
    });
  });
  addFooter(s, 7);
  s.addNotes(
    "技术栈：Next.js 与 TypeScript；LangGraph 编排；Supabase 数据与鉴权；自研规则与评分；可插拔 LLM 与向量库。依赖方向 app → server → lib，Key 仅服务端；没有 Key 也能演示确定性路径。",
  );
}

// ─── 8. 数据来源 ─────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s, pres);
  addSlideTitle(s, "数据来源", "演示数据可公开复现；生产数据由企业上传与制度库提供");

  const sources = [
    {
      title: "财务流水输入",
      body: "用户上传 Excel / CSV。演示样例 fixtures/demo-financial-audit.csv，内含重复发票、缺审批、金额离群等可控风险点。",
    },
    {
      title: "制度知识库（RAG）",
      body: "企业自建制度条目（制度名、条款号、正文）。解释层检索本公司制度；无 Key 时确定性路径仍可完整演示。",
    },
    {
      title: "审计过程产物",
      body: "任务、Issue、证据快照、规则版本、工单日志与报告写入 Supabase，按用户/角色隔离，支持底稿归档导出。",
    },
  ];
  sources.forEach((src, i) => {
    const y = 1.35 + i * 1.15;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.5,
      y,
      w: 9,
      h: 1.05,
      fill: { color: C.white },
      shadow: shadowSoft(),
      rectRadius: 0.08,
    });
    s.addText(src.title, {
      x: 0.75,
      y: y + 0.15,
      w: 8.5,
      h: 0.28,
      fontSize: 14,
      fontFace: "Arial",
      bold: true,
      color: C.navyDeep,
      margin: 0,
    });
    s.addText(src.body, {
      x: 0.75,
      y: y + 0.48,
      w: 8.5,
      h: 0.45,
      fontSize: 12,
      fontFace: "Arial",
      color: C.slate,
      margin: 0,
    });
  });
  addFooter(s, 8);
  s.addNotes(
    "三类数据：一是用户上传的财务流水，演示样例为 fixtures/demo-financial-audit.csv；二是企业制度知识库，供 RAG 引用；三是审计过程产物写入 Supabase，按用户与角色隔离。评委可看公开样例，也可现场上传验证。",
  );
}

// ─── 9. 预期价值 ─────────────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s, pres);
  addSlideTitle(s, "预期价值", "把「抽检运气」变成「可解释、可分派、可验收」的审计产能");

  const values = [
    {
      k: "覆盖率",
      t: "从抽样到全量扫描",
      d: "同一套规则对整批流水跑一遍，降低漏检；高风险优先人工复核。",
    },
    {
      k: "证据力",
      t: "发现即带凭证与制度",
      d: "Issue 挂证据行 + 规则 ID/阈值；RAG 指向条款号，复核成本下降。",
    },
    {
      k: "闭环率",
      t: "整改不再断在邮件里",
      d: "分派 → 业务提交 → 审计验收；禁止业务直接关单，过程可追溯。",
    },
    {
      k: "可信度",
      t: "规则判风险，AI 只解释",
      d: "确定性路径可演示、可复现；LLM 优雅降级，不绑架核心判责。",
    },
  ];
  values.forEach((v, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 4.7;
    const y = 1.4 + row * 1.7;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x,
      y,
      w: 4.5,
      h: 1.5,
      fill: { color: C.white },
      shadow: shadowSoft(),
      rectRadius: 0.1,
    });
    s.addText(v.k, {
      x: x + 0.25,
      y: y + 0.2,
      w: 4,
      h: 0.28,
      fontSize: 12,
      fontFace: "Arial",
      bold: true,
      color: C.navy,
      margin: 0,
    });
    s.addText(v.t, {
      x: x + 0.25,
      y: y + 0.5,
      w: 4,
      h: 0.32,
      fontSize: 15,
      fontFace: "Arial",
      bold: true,
      color: C.navyDeep,
      margin: 0,
    });
    s.addText(v.d, {
      x: x + 0.25,
      y: y + 0.9,
      w: 4,
      h: 0.4,
      fontSize: 12,
      fontFace: "Arial",
      color: C.muted,
      margin: 0,
    });
  });
  addFooter(s, 9);
  s.addNotes(
    "预期价值四点：覆盖率——整批扫描、高风险优先复核；证据力——发现即带凭证与制度；闭环率——整改可验收可追溯；可信度——规则判风险、AI 只解释，核心能力不依赖 LLM。",
  );
}

// ─── 10. 推广可能 + 收尾 ─────────────────────────────────
{
  const s = pres.addSlide();
  lightBg(s, pres);
  addSlideTitle(s, "推广可能", "先做企业内闭环，再向日常流程与规模化演进");

  const paths = [
    {
      stage: "近期落地",
      items: [
        "内审/财务合规试点：上传 → 复核 → 整改验收",
        "公开 fixture + 现场上传，证明可复现",
        "无 LLM Key 亦可演示确定性能力",
      ],
    },
    {
      stage: "中期扩展",
      items: [
        "对接主数据源，按期间自动抽检",
        "AI 解释人工确认后门闩入档",
        "规则版本与制度库随制度迭代",
      ],
    },
    {
      stage: "远期方向",
      items: [
        "多法人 / 多组织规模化",
        "对接 GRC / OA，嵌入日常流程",
        "行业规则包与合规能力按需加深",
      ],
    },
  ];
  paths.forEach((p, i) => {
    const x = 0.5 + i * 3.1;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x,
      y: 1.35,
      w: 2.95,
      h: 3.5,
      fill: { color: C.white },
      shadow: shadowSoft(),
      rectRadius: 0.1,
    });
    s.addText(p.stage, {
      x: x + 0.18,
      y: 1.55,
      w: 2.6,
      h: 0.4,
      fontSize: 16,
      fontFace: "Arial",
      bold: true,
      color: C.navyDeep,
      margin: 0,
    });
    p.items.forEach((item, j) => {
      s.addText(`${j + 1}.  ${item}`, {
        x: x + 0.18,
        y: 2.15 + j * 0.8,
        w: 2.6,
        h: 0.7,
        fontSize: 13,
        fontFace: "Arial",
        color: C.slate,
        margin: 0,
      });
    });
  });
  addFooter(s, 10);
  s.addNotes(
    "推广三步：近期内审或财务合规试点，公开样例加现场上传证明可复现；中期对接主数据源按期间抽检；远期再做多法人与 GRC 对接——先闭环，再平台化。以上是 AuditLens AI，欢迎提问。谢谢大家。",
  );
}

pres.writeFile({ fileName: OUT }).then(() => {
  console.log("Wrote", OUT);
});
