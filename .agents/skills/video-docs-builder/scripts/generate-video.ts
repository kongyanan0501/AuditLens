/**
 * Records a browser session using Playwright with deterministic timing.
 *
 * Flow:
 *  1. Run setup[] steps (recorded but fast, no narration) — typically login
 *  2. Run each step with (action_ms + audio_duration_ms) pauses
 *
 * Features:
 *  - Visible cursor overlay: red dot follows real cursor position
 *  - trim_start_ms: stored in enriched JSON so assemble.ts can trim the login
 *
 * Usage: tsx src/generate-video.ts projects/demo-app/flows/01-feature-demo.json
 *        tsx src/generate-video.ts projects/demo-app/flows/01-feature-demo.enriched.json
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Flow, FlowStep, SetupStep, ProjectConfig, VideoPart } from './types.js';
import { projectRootFromFlow, detectLangFromFlow, projectPaths } from './paths.js';

/** LLM / uncontrollable waits: run off-camera between recorded parts. */
function isOffrecordBreak(step: FlowStep): boolean {
  if (step.offrecord) return true;
  return step.action === 'wait_job_done' && !!(step.playback_speed && step.playback_speed > 1);
}

const ACCEL_SLATE_DEFAULT_MS = Math.max(
  1500,
  parseInt(process.env.ACCEL_SLATE_MS ?? '2500', 10) || 2500,
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Cursor overlay injected into every page ────────────────────────────────
const CURSOR_SCRIPT = `
(function() {
  if (document.__cursorInjected) return;
  document.__cursorInjected = true;

  // Inject keyframe animation for pulse ring
  const style = document.createElement('style');
  style.textContent = \`
    @keyframes __cursor_pulse {
      0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.7; }
      70%  { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
      100% { transform: translate(-50%,-50%) scale(1);   opacity: 0; }
    }
    @keyframes __cursor_click {
      0%   { transform: translate(-50%,-50%) scale(1); }
      30%  { transform: translate(-50%,-50%) scale(0.7); }
      100% { transform: translate(-50%,-50%) scale(1); }
    }
  \`;
  document.head.appendChild(style);

  // Outer pulse ring
  const ring = document.createElement('div');
  Object.assign(ring.style, {
    position: 'fixed', top: '0px', left: '0px',
    width: '28px', height: '28px',
    border: '2.5px solid rgba(220,38,38,0.7)',
    borderRadius: '50%', pointerEvents: 'none',
    zIndex: '2147483646',
    transform: 'translate(-50%,-50%)',
    animation: '__cursor_pulse 1.4s ease-out infinite',
  });

  // Main dot
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    position: 'fixed', top: '0px', left: '0px',
    width: '22px', height: '22px',
    background: 'rgba(220, 38, 38, 0.95)',
    borderRadius: '50%', pointerEvents: 'none',
    zIndex: '2147483647',
    transform: 'translate(-50%,-50%)',
    boxShadow: '0 0 0 3px white, 0 2px 8px rgba(0,0,0,0.6)',
    transition: 'left 0.06s ease-out, top 0.06s ease-out',
  });

  document.body.appendChild(ring);
  document.body.appendChild(dot);

  function moveTo(x, y) {
    dot.style.left = x + 'px'; dot.style.top = y + 'px';
    ring.style.left = x + 'px'; ring.style.top = y + 'px';
  }

  document.addEventListener('mousemove', function(e) { moveTo(e.clientX, e.clientY); });
  document.addEventListener('mousedown', function() {
    dot.style.animation = '__cursor_click 0.2s ease-out';
    setTimeout(function(){ dot.style.animation = ''; }, 220);
  });

  // Start at center
  moveTo(window.innerWidth / 2, window.innerHeight / 2);
  window.__moveCursor = moveTo;
})();
`;

// ── Spotlight: Playwright resolves selectors; we only paint the overlay. ───
async function applyHighlight(page: Page, step: FlowStep): Promise<void> {
  const sel = step.highlight ?? step.selector ?? step.wait_for;
  if (!sel || sel.startsWith('http')) return;
  if (sel === 'text=上传成功' || sel === 'text=已完成') return;

  const loc = page.locator(sel).first();
  try {
    await loc.waitFor({ state: 'visible', timeout: 4000 });
    await loc.scrollIntoViewIfNeeded();
  } catch {
    console.warn(`   ⚠️  highlight miss (not visible): ${sel}`);
    return;
  }

  const box = await loc.boundingBox();
  if (!box || box.width < 2 || box.height < 2) {
    console.warn(`   ⚠️  highlight miss (no box): ${sel}`);
    return;
  }

  const label = step.highlight_label ?? null;
  await page.evaluate(
    ({ box, label }) => {
      const PAD = 10;
      const top = Math.max(8, box.y - PAD);
      const left = Math.max(8, box.x - PAD);
      const width = Math.min(window.innerWidth - left - 8, box.width + PAD * 2);
      const height = Math.min(window.innerHeight - top - 8, box.height + PAD * 2);

      let style = document.getElementById('__demo_hl_style');
      if (!style) {
        style = document.createElement('style');
        style.id = '__demo_hl_style';
        style.textContent = `
          #__demo_hl_root { pointer-events: none; position: fixed; inset: 0; z-index: 2147483640; }
          #__demo_hl_hole {
            position: absolute; border: 2.5px solid #f59e0b; border-radius: 10px;
            box-shadow: 0 0 0 9999px rgba(15,23,42,0.55), 0 0 0 3px rgba(245,158,11,0.35), 0 8px 28px rgba(0,0,0,0.35);
            background: transparent;
          }
          #__demo_hl_label {
            position: absolute; max-width: min(360px, 70vw); padding: 6px 12px; border-radius: 6px;
            background: #111827; color: #f8fafc;
            font: 600 13px/1.35 ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
            box-shadow: 0 4px 16px rgba(0,0,0,0.35); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }`;
        document.documentElement.appendChild(style);
      }

      let root = document.getElementById('__demo_hl_root');
      if (!root) {
        root = document.createElement('div');
        root.id = '__demo_hl_root';
        root.innerHTML = '<div id="__demo_hl_hole"></div><div id="__demo_hl_label"></div>';
        document.body.appendChild(root);
      }
      root.style.display = 'block';
      const hole = root.querySelector('#__demo_hl_hole') as HTMLElement;
      const lab = root.querySelector('#__demo_hl_label') as HTMLElement;
      hole.style.top = `${top}px`;
      hole.style.left = `${left}px`;
      hole.style.width = `${width}px`;
      hole.style.height = `${height}px`;
      if (label) {
        lab.style.display = 'block';
        lab.textContent = label;
        let labTop = top - 36;
        if (labTop < 8) labTop = top + height + 10;
        lab.style.top = `${labTop}px`;
        lab.style.left = `${Math.min(left, window.innerWidth - 200)}px`;
      } else {
        lab.style.display = 'none';
      }
    },
    { box, label },
  );

  console.log(`   🔦 highlight → ${sel}${label ? ` (${label})` : ''}`);
}

async function clearHighlight(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const root = document.getElementById('__demo_hl_root');
      if (root) root.style.display = 'none';
    })
    .catch(() => {});
}

// ── Mailpit: extract 6-digit verification code ─────────────────────────────
async function extractMailpitCode(mailpitUrl: string, toEmail: string): Promise<string> {
  const listUrl = `${mailpitUrl}/api/v1/messages`;
  const res = await fetch(listUrl);
  const data = await res.json() as { messages?: Array<{ ID: string; To: Array<{ Address: string }> }> };
  const messages = data.messages ?? [];

  const msg = messages.find(m => m.To.some(t => t.Address === toEmail));
  if (!msg) throw new Error(`No mailpit email found for ${toEmail}`);

  const bodyRes = await fetch(`${mailpitUrl}/api/v1/message/${msg.ID}`);
  const body = await bodyRes.json() as { Text?: string; HTML?: string };
  const text = body.Text ?? body.HTML ?? '';

  const match = text.match(/\b(\d{6})\b/);
  if (!match) throw new Error(`No 6-digit code found in email to ${toEmail}`);
  return match[1];
}

// ── Execute a single step ──────────────────────────────────────────────────
async function executeStep(page: Page, step: FlowStep | SetupStep, variables: Record<string, string>, config: ProjectConfig): Promise<void> {
  const resolve = (val: string) =>
    val
      .replace(/\$\{email\}/g, config.setup_login.email)
      .replace(/\$\{password\}/g, config.setup_login.password)
      .replace(/\$\{(\w+)\}/g, (_, k) => variables[k] ?? '');

  const locator = (sel: string, nth?: number) =>
    nth !== undefined ? page.locator(sel).nth(nth) : page.locator(sel).first();

  switch (step.action) {
    case 'navigate': {
      const url = resolve(step.value!);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      console.log(`   📍 ${page.url()}`);
      break;
    }
    case 'fill': {
      const flowStep = step as FlowStep;
      await locator(step.selector!, flowStep.nth).waitFor({ timeout: 8000 });
      await locator(step.selector!, flowStep.nth).fill(resolve(step.value!));
      break;
    }
    case 'upload': {
      const flowStep = step as FlowStep;
      const filePath = resolve(step.value!);
      await locator(step.selector!, flowStep.nth).waitFor({ timeout: 8000, state: 'attached' });
      await locator(step.selector!, flowStep.nth).setInputFiles(filePath);
      console.log(`   📎 uploaded ${filePath}`);
      break;
    }
    case 'click': {
      const flowStep = step as FlowStep;
      const clickTimeout = flowStep.wait_timeout_ms ?? 8000;
      await locator(step.selector!, flowStep.nth).waitFor({ timeout: clickTimeout });
      await locator(step.selector!, flowStep.nth).click({ timeout: clickTimeout });
      console.log(`   📍 ${page.url()}`);
      break;
    }
    case 'wait_ms':
      await page.waitForTimeout(parseInt(step.value ?? '1000'));
      break;
    case 'wait':
      break;
    case 'wait_job_done': {
      // Poll first task row until 已完成. On 失败, click 重试 (value = max retries, default 2).
      const flowStep = step as FlowStep;
      const timeout = flowStep.wait_timeout_ms ?? 360_000;
      const maxRetries = Math.max(0, parseInt(flowStep.value ?? '2', 10) || 2);
      const deadline = Date.now() + timeout;
      let retries = 0;
      console.log(`   ⏳ wait_job_done (timeout ${(timeout / 1000).toFixed(0)}s, retries=${maxRetries})`);
      while (Date.now() < deadline) {
        const row = page.locator('ul li').first();
        const text = (await row.innerText().catch(() => '')) || '';
        if (text.includes('已完成')) {
          console.log('   ✅ first job: 已完成');
          break;
        }
        if (text.includes('失败')) {
          const errLine = text.split('\n').find(l => l.includes('失败') || l.includes('Error') || l.includes('error'));
          console.warn(`   ⚠️  first job failed${errLine ? `: ${errLine.slice(0, 120)}` : ''}`);
          const retryBtn = row.locator('button:has-text("重试")');
          if (retries < maxRetries && (await retryBtn.count()) > 0) {
            retries += 1;
            console.log(`   ↻ click 重试 (${retries}/${maxRetries})`);
            await retryBtn.click();
            await page.waitForTimeout(2500);
            continue;
          }
          throw new Error('wait_job_done: job failed and retries exhausted');
        }
        // Keep StatusPoller alive: light interaction not needed; just wait.
        await page.waitForTimeout(2000);
      }
      const finalText = (await page.locator('ul li').first().innerText().catch(() => '')) || '';
      if (!finalText.includes('已完成')) {
        throw new Error('wait_job_done: timed out waiting for 已完成');
      }
      break;
    }
    case 'hover': {
      const flowStep = step as FlowStep;
      await locator(step.selector!, flowStep.nth).waitFor({ timeout: 8000 });
      await locator(step.selector!, flowStep.nth).hover();
      break;
    }
    case 'scroll': {
      // step.value: "down" | "up" | "<px>" (default 300px down)
      const amount = step.value === 'up' ? -400 : step.value === 'down' ? 400 : parseInt(step.value ?? '400', 10);
      if (step.selector) {
        const flowStep = step as FlowStep;
        await locator(step.selector, flowStep.nth).waitFor({ timeout: 5000 }).catch(() => {});
        await locator(step.selector, flowStep.nth).scrollIntoViewIfNeeded().catch(() => {});
      } else {
        await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), amount);
      }
      break;
    }
    case 'mailpit_code': {
      const flowStep = step as FlowStep;
      const mailpitUrl = config.mailpit_url ?? 'http://localhost:8026';
      const email = flowStep.email ?? config.credentials.admin.email;
      console.log(`   📬 Extracting code from mailpit for ${email}...`);
      const code = await extractMailpitCode(mailpitUrl, email);
      const varName = flowStep.value ?? 'verification_code';
      variables[varName] = code;
      console.log(`   🔑 Code: ${code} → $\{${varName}}`);
      break;
    }
    case 'blur': {
      const flowStep = step as FlowStep;
      await locator(step.selector!, flowStep.nth).waitFor({ timeout: 8000 });
      await locator(step.selector!, flowStep.nth).press('Tab');
      break;
    }
    case 'type': {
      // Types character-by-character with delay — use when fill() doesn't trigger
      // input validation or masked fields that require real keyboard events.
      const flowStep = step as FlowStep;
      await locator(step.selector!, flowStep.nth).waitFor({ timeout: 8000 });
      await locator(step.selector!, flowStep.nth).click();
      await page.keyboard.type(resolve(step.value!), { delay: 200 });
      break;
    }
    case 'otp_fill': {
      // Fills a multi-input OTP component (e.g. 6 separate inputs) digit by digit.
      // Uses fill() on each nth input so React onChange fires correctly.
      const code = resolve(step.value!);
      const sel = step.selector ?? 'input[inputmode="numeric"]';
      const inputs = page.locator(sel);
      await inputs.first().waitFor({ timeout: 8000 });
      for (let i = 0; i < code.length; i++) {
        await inputs.nth(i).fill(code[i]);
        await page.waitForTimeout(150);
      }
      break;
    }
    case 'paste': {
      // Dispatches a ClipboardEvent — use for React controlled inputs that
      // listen to onPaste instead of onChange and ignore programmatic fill().
      const flowStep = step as FlowStep;
      const text = resolve(step.value!);
      await locator(step.selector!, flowStep.nth).waitFor({ timeout: 8000 });
      await locator(step.selector!, flowStep.nth).click();
      await page.evaluate(({ sel, text }: { sel: string; text: string }) => {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (!el) return;
        el.focus();
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      }, { sel: step.selector!, text });
      break;
    }
    case 'screenshot':
      break;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const flowPath = process.argv[2];
  if (!flowPath) {
    console.error('Usage: tsx src/generate-video.ts <flow.json|flow.enriched.json>');
    process.exit(1);
  }

  const flow = JSON.parse(fs.readFileSync(flowPath, 'utf-8')) as Flow;
  const lang = detectLangFromFlow(flowPath);
  const root = projectRootFromFlow(flowPath);
  const paths = projectPaths(root, flow.output_name, lang);
  const configPath = paths.config;
  if (!fs.existsSync(configPath)) throw new Error(`config.json not found: ${configPath}`);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as ProjectConfig;
  const rawDir = paths.raw!;
  fs.mkdirSync(rawDir, { recursive: true });

  const showCursor = flow.show_cursor !== false; // default true
  console.log(`🎬 "${flow.title}" [${flow.project ?? path.basename(path.dirname(root))}]`);
  console.log(`   Viewport: ${flow.viewport.width}x${flow.viewport.height}`);
  console.log(`   Steps: ${flow.steps.length}${flow.use_setup_login ? ' (+ auto-login)' : ''}${showCursor ? '' : ' (cursor hidden)'}`);

  const variables: Record<string, string> = {};
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const totalSteps = flow.steps.length;

  // Split around off-record breaks (LLM waits): [part0 steps][break][part1 steps]…
  type Chunk =
    | { kind: 'record'; steps: FlowStep[] }
    | { kind: 'offrecord'; step: FlowStep };
  const chunks: Chunk[] = [];
  let buf: FlowStep[] = [];
  for (const step of flow.steps) {
    if (isOffrecordBreak(step)) {
      if (buf.length) {
        chunks.push({ kind: 'record', steps: buf });
        buf = [];
      }
      chunks.push({ kind: 'offrecord', step });
    } else {
      buf.push(step);
    }
  }
  if (buf.length) chunks.push({ kind: 'record', steps: buf });

  const hasSplit = chunks.some((c) => c.kind === 'offrecord');
  if (hasSplit) {
    console.log(`   📼 Segmented recording: ${chunks.filter((c) => c.kind === 'record').length} parts around off-record LLM wait(s)`);
  }

  const videoParts: VideoPart[] = [];
  let storageState: Awaited<ReturnType<BrowserContext['storageState']>> | undefined;
  let resumeUrl = `${config.base_url}/dashboard`;
  let globalStep = 0;
  let partIndex = 0;
  let slateMs = ACCEL_SLATE_DEFAULT_MS;

  async function openRecordingContext(): Promise<{ context: BrowserContext; page: Page; clockStart: number }> {
    const context = await browser.newContext({
      viewport: flow.viewport,
      recordVideo: { dir: rawDir, size: flow.viewport },
      ...(storageState ? { storageState } : {}),
    });
    if (showCursor) await context.addInitScript(CURSOR_SCRIPT);
    const page = await context.newPage();
    return { context, page, clockStart: Date.now() };
  }

  async function savePartVideo(
    context: BrowserContext,
    page: Page,
    partIdx: number,
  ): Promise<string> {
    const tmpPath = await page.video()?.path();
    await context.close();
    const dest = path.join(rawDir, `${flow.output_name}.part${partIdx}.webm`);
    if (tmpPath && fs.existsSync(tmpPath)) {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      fs.renameSync(tmpPath, dest);
    }
    return dest;
  }

  async function runRecordedSteps(
    page: Page,
    steps: FlowStep[],
    partIdx: number,
  ): Promise<{ trim_start_ms?: number }> {
    const videoClockStart = Date.now();
    // Warm page for part>0 (session restored; land on dashboard before actions)
    if (partIdx > 0) {
      await page.goto(resumeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(600);
    } else {
      if (flow.use_setup_login) {
        const { email, password } = config.setup_login;
        console.log(`\n🔐 Setup: logging in as ${email}...`);
        await page.goto(`${config.base_url}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.locator('#email').fill(email);
        await page.waitForTimeout(150);
        await page.locator('#password').fill(password);
        await page.waitForTimeout(150);
        await page.locator('button[type=submit]').click();
        await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 12000 }).catch(() => {
          console.warn(`   ⚠️  Login redirect timeout, current URL: ${page.url()}`);
        });
        await page.waitForTimeout(800);
        console.log(`   ✅ Logged in → ${page.url()}`);
      }
      for (const step of flow.setup ?? []) {
        await executeStep(page, step, variables, config);
        await page.waitForTimeout(300);
      }
    }

    const recordingStart = Date.now();
    const prefixMs = Math.max(0, recordingStart - videoClockStart);
    let trim_start_ms: number | undefined;
    if (prefixMs > 100) {
      trim_start_ms = prefixMs;
      console.log(`   ✂️  part${partIdx} prefix ${(prefixMs / 1000).toFixed(2)}s`);
    }

    // Timestamps are relative to THIS part only (critical for post-LLM sync).
    let actualCursor = 0;

    for (const step of steps) {
      globalStep += 1;
      const pct = Math.round((globalStep / totalSteps) * 100);
      console.log(
        `\n▶  [${globalStep}/${totalSteps}] (${pct}%) [part${partIdx}/${step.id}] ${step.action}` +
          `${step.value ? ` → ${String(step.value).slice(0, 60)}` : ''}`,
      );

      const stepRawStart = actualCursor;
      const stepStart = Date.now();

      await executeStep(page, step, variables, config);

      if (step.wait_for_url) {
        await page.waitForURL(`**${step.wait_for_url}`, { timeout: step.wait_timeout_ms ?? 20000 }).catch(() => {
          console.warn(`   ⚠️  Expected URL "${step.wait_for_url}", got: ${page.url()}`);
        });
      }
      if (step.wait_for) {
        const waitMs = step.wait_timeout_ms ?? 10000;
        await page.locator(step.wait_for).first().waitFor({ timeout: waitMs }).catch(() => {
          console.warn(`   ⚠️  wait_for not found (${waitMs}ms): ${step.wait_for}`);
        });
      }

      await page.waitForTimeout(step.action_ms);

      const actionActualMs = Date.now() - stepStart;
      actualCursor += actionActualMs;
      step.audio_start_ms = actualCursor;

      const narrationMs = (step.audio_duration_ms ?? 0) + (step.narration ? 500 : 0);
      if (narrationMs > 0) {
        if (step.narration) await applyHighlight(page, step);
        console.log(`   ⏸  ${(narrationMs / 1000).toFixed(1)}s narration pause`);
        await page.waitForTimeout(narrationMs);
        await clearHighlight(page);
        actualCursor += narrationMs;
      } else {
        await clearHighlight(page);
      }

      step.raw_start_ms = stepRawStart;
      step.raw_end_ms = actualCursor;
      step.record_part = partIdx;

      if (step.narration) {
        console.log(`   📍 part${partIdx} audio_start_ms=${step.audio_start_ms}ms`);
      }
      if (step.wait_for_url) console.log(`   📍 ${page.url()}`);
    }

    resumeUrl = page.url();
    return { trim_start_ms };
  }

  // ── Execute chunks ───────────────────────────────────────────────────────
  for (const chunk of chunks) {
    if (chunk.kind === 'offrecord') {
      const step = chunk.step;
      slateMs = ACCEL_SLATE_DEFAULT_MS;
      step.offrecord = true;
      step.record_part = -1;
      step.raw_start_ms = 0;
      step.raw_end_ms = 0;
      step.audio_start_ms = 0;
      globalStep += 1;
      console.log(
        `\n⏭  [${globalStep}/${totalSteps}] OFF-RECORD [${step.id}] ${step.action}` +
          ` (slate ${(slateMs / 1000).toFixed(1)}s in final)`,
      );

      // Wait without recording so uncontrollable LLM time never enters the webm.
      const context = await browser.newContext({
        viewport: flow.viewport,
        ...(storageState ? { storageState } : {}),
      });
      const page = await context.newPage();
      await page.goto(resumeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(500);

      // Page reload drops React upload state — re-attach file when requested.
      if (step.upload_before) {
        const filePath = step.upload_before
          .replace(/\$\{email\}/g, config.setup_login.email)
          .replace(/\$\{password\}/g, config.setup_login.password)
          .replace(/\$\{(\w+)\}/g, (_, k) => variables[k] ?? '');
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.waitFor({ timeout: 10000, state: 'attached' });
        await fileInput.setInputFiles(filePath);
        console.log(`   📎 upload_before ${filePath}`);
        await page
          .locator('button:has-text("开始分析"):not([disabled])')
          .first()
          .waitFor({ timeout: 10000 })
          .catch(() => {
            console.warn('   ⚠️  analyze button still disabled after upload_before');
          });
      }

      await executeStep(page, step, variables, config);
      if (step.wait_for_url) {
        await page
          .waitForURL(`**${step.wait_for_url}`, {
            timeout: step.wait_timeout_ms ?? 20000,
          })
          .catch(() => {
            console.warn(
              `   ⚠️  Expected URL "${step.wait_for_url}", got: ${page.url()}`,
            );
          });
      }
      if (step.wait_for) {
        const waitMs = step.wait_timeout_ms ?? 10000;
        await page
          .locator(step.wait_for)
          .first()
          .waitFor({ timeout: waitMs })
          .catch(() => {
            console.warn(`   ⚠️  wait_for not found (${waitMs}ms): ${step.wait_for}`);
          });
      }
      if (step.action_ms) await page.waitForTimeout(step.action_ms);
      resumeUrl = page.url();
      storageState = await context.storageState();
      await context.close();
      console.log(`   ✅ off-record wait done → resume at ${resumeUrl}`);
      continue;
    }

    // Recorded part
    const { context, page } = await openRecordingContext();
    // First part may need login; later parts use storageState
    if (partIndex === 0 && !storageState && !flow.use_setup_login) {
      // still ok — steps usually include login
    }
    const meta = await runRecordedSteps(page, chunk.steps, partIndex);
    storageState = await context.storageState();
    const file = await savePartVideo(context, page, partIndex);
    videoParts.push({
      index: partIndex,
      file,
      trim_start_ms: meta.trim_start_ms,
      step_ids: chunk.steps.map((s) => s.id),
    });
    console.log(`   💾 Saved ${file}`);
    partIndex += 1;
  }

  await browser.close();

  // Legacy single-file alias = part0 (assemble prefers video_parts when present)
  const expectedVideo = path.join(rawDir, `${flow.output_name}.webm`);
  if (videoParts[0]?.file && fs.existsSync(videoParts[0].file)) {
    fs.copyFileSync(videoParts[0].file, expectedVideo);
  }

  flow.video_parts = videoParts;
  flow.accel_slate_ms = hasSplit ? slateMs : undefined;
  if (videoParts[0]?.trim_start_ms) flow.trim_start_ms = videoParts[0].trim_start_ms;

  // Update enriched JSON with REAL measured timings + parts
  const enrichedPath = flowPath.endsWith('.enriched.json') ? flowPath : flowPath.replace('.json', '.enriched.json');
  if (fs.existsSync(enrichedPath)) {
    const enriched = JSON.parse(fs.readFileSync(enrichedPath, 'utf-8')) as Flow;
    enriched.trim_start_ms = flow.trim_start_ms;
    enriched.video_parts = videoParts;
    enriched.accel_slate_ms = flow.accel_slate_ms;
    for (const measured of flow.steps) {
      const target = enriched.steps.find((s) => s.id === measured.id);
      if (!target) continue;
      target.audio_start_ms = measured.audio_start_ms;
      target.raw_start_ms = measured.raw_start_ms;
      target.raw_end_ms = measured.raw_end_ms;
      target.record_part = measured.record_part;
      target.offrecord = measured.offrecord;
      if (measured.playback_speed !== undefined) target.playback_speed = measured.playback_speed;
      if (measured.accelerate_caption !== undefined) {
        target.accelerate_caption = measured.accelerate_caption;
      }
    }
    fs.writeFileSync(enrichedPath, JSON.stringify(enriched, null, 2));
    console.log(`\n   ✅ Updated enriched.json (segmented timings + video_parts)`);
  }

  console.log(`\n✅ Video recorded: ${videoParts.map((p) => p.file).join(' + ')}`);
}

main().catch((err: unknown) => { console.error(err); process.exit(1); });
