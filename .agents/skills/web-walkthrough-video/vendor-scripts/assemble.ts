/**
 * Assembles final video: optional wait-segment jump-cut (not setpts speedup),
 * then overlays narration + burned subtitles in a second pass.
 *
 * Jump-cut keeps the last N ms of an accelerated wait (default 2.5s) so A/V
 * timestamps stay honest — setpts×N + multi-trim was desyncing narration.
 *
 * Usage: tsx scripts/assemble.ts <flow.enriched.json>
 */
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Flow, FlowStep } from './types.js';
import { projectRootFromFlow, detectLangFromFlow, projectPaths } from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Keep this much of each accelerated wait (tail), rest is cut. */
const ACCEL_KEEP_MS = Math.max(
  1500,
  parseInt(process.env.ACCEL_KEEP_MS ?? '2500', 10) || 2500,
);

interface TimelineSeg {
  rawStartMs: number;
  rawEndMs: number;
  /** Output duration of this segment (= raw span, or ACCEL_KEEP_MS if cut). */
  outDurationMs: number;
  /** If set, extract the tail of the raw span (jump-cut). */
  extractTailMs?: number;
  caption?: string;
}

function checkFFmpeg(): void {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf-8' });
  if (result.error) {
    console.error('❌ ffmpeg not found. Install with: brew install ffmpeg');
    process.exit(1);
  }
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

function msToSrtTime(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  const milli = clamped % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milli, 3)}`;
}

const isAsciiWord = (ch: string) => /[A-Za-z0-9._-]/.test(ch);
const isBreakPunct = (ch: string) => /[，。；、！？,.!?;:\s]/.test(ch);

function wrapCaption(text: string, maxChars = 22): string {
  const chars = [...text.trim()];
  if (chars.length <= maxChars) return chars.join('');
  const lines: string[] = [];
  let i = 0;
  while (i < chars.length && lines.length < 3) {
    const remaining = chars.length - i;
    if (remaining <= maxChars || lines.length === 2) {
      lines.push(chars.slice(i).join(''));
      break;
    }
    const softMin = i + Math.floor(maxChars * 0.55);
    const hardMax = Math.min(chars.length, i + maxChars + 8);
    let breakAt = -1;
    for (let j = hardMax - 1; j >= softMin; j--) {
      if (isBreakPunct(chars[j]!)) {
        breakAt = j + 1;
        break;
      }
    }
    if (breakAt < 0) {
      breakAt = Math.min(i + maxChars, chars.length);
      if (breakAt < chars.length && isAsciiWord(chars[breakAt]!)) {
        let end = breakAt;
        while (end < chars.length && isAsciiWord(chars[end]!)) end++;
        if (end - i <= maxChars + 12) breakAt = end;
        else {
          while (breakAt > softMin && isAsciiWord(chars[breakAt - 1]!)) breakAt--;
        }
      } else if (breakAt > 0 && isAsciiWord(chars[breakAt - 1]!)) {
        let start = breakAt;
        while (start > softMin && isAsciiWord(chars[start - 1]!)) start--;
        if (start > i) breakAt = start;
      }
    }
    lines.push(chars.slice(i, breakAt).join('').trimEnd());
    i = breakAt;
    while (i < chars.length && /\s/.test(chars[i]!)) i++;
  }
  return lines.join('\n');
}

function escapeSubtitlesPath(p: string): string {
  return p
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function probeDurationMs(videoPath: string): number | null {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
      { encoding: 'utf-8' },
    ).trim();
    const sec = parseFloat(out);
    if (!Number.isFinite(sec) || sec <= 0) return null;
    return Math.round(sec * 1000);
  } catch {
    return null;
  }
}

function run(cmd: string, quiet = false): void {
  // Never use stdio:'pipe' without consumers — ffmpeg can fill the buffer and deadlock.
  execSync(cmd, { stdio: quiet ? ['ignore', 'ignore', 'ignore'] : 'inherit' });
}

/** Coarse segments: merge 1× spans; accelerated waits become jump-cuts. */
function buildSegments(steps: FlowStep[], videoDurationMs: number): TimelineSeg[] {
  type Fine = { rawStartMs: number; rawEndMs: number; accelerate: boolean; caption?: string };
  const fine: Fine[] = [];
  let cursor = 0;

  for (const step of steps) {
    const rawStart = step.raw_start_ms ?? cursor;
    const rawEnd =
      step.raw_end_ms ??
      (step.audio_start_ms ?? rawStart) + (step.audio_duration_ms ?? 0) + step.action_ms;
    if (rawStart > cursor + 40) {
      fine.push({ rawStartMs: cursor, rawEndMs: rawStart, accelerate: false });
    }
    const accelerate = !!(step.playback_speed && step.playback_speed > 1);
    const end = Math.max(rawStart, rawEnd);
    if (end > rawStart + 20) {
      fine.push({
        rawStartMs: rawStart,
        rawEndMs: end,
        accelerate,
        caption: accelerate ? (step.accelerate_caption ?? '【视频加速中】') : undefined,
      });
    }
    cursor = Math.max(cursor, end);
  }
  if (videoDurationMs > cursor + 100) {
    fine.push({ rawStartMs: cursor, rawEndMs: videoDurationMs, accelerate: false });
  }

  // Merge adjacent non-accelerate
  const merged: Fine[] = [];
  for (const s of fine) {
    const prev = merged[merged.length - 1];
    if (prev && !prev.accelerate && !s.accelerate && Math.abs(prev.rawEndMs - s.rawStartMs) < 40) {
      prev.rawEndMs = s.rawEndMs;
    } else {
      merged.push({ ...s });
    }
  }

  return merged.map((s) => {
    const rawDur = s.rawEndMs - s.rawStartMs;
    if (s.accelerate && rawDur > ACCEL_KEEP_MS + 500) {
      return {
        rawStartMs: s.rawStartMs,
        rawEndMs: s.rawEndMs,
        outDurationMs: ACCEL_KEEP_MS,
        extractTailMs: ACCEL_KEEP_MS,
        caption: s.caption,
      };
    }
    return {
      rawStartMs: s.rawStartMs,
      rawEndMs: s.rawEndMs,
      outDurationMs: rawDur,
      caption: s.caption,
    };
  });
}

/** Map a raw (phase-2) timestamp onto the jump-cut output timeline. */
function rawToOutputMs(rawMs: number, segs: TimelineSeg[]): number {
  let out = 0;
  for (const s of segs) {
    if (rawMs <= s.rawStartMs) return out;

    if (rawMs < s.rawEndMs) {
      if (s.extractTailMs) {
        const tailStart = s.rawEndMs - s.extractTailMs;
        if (rawMs < tailStart) return out; // cut away — pin to segment start
        return out + (rawMs - tailStart);
      }
      return out + (rawMs - s.rawStartMs);
    }

    out += s.outDurationMs;
  }
  return out;
}

function writeSrt(steps: FlowStep[], segs: TimelineSeg[], srtPath: string): void {
  type Cue = { start: number; end: number; text: string };
  const cues: Cue[] = [];

  let outCursor = 0;
  for (const s of segs) {
    if (s.caption) {
      cues.push({
        start: outCursor,
        end: outCursor + s.outDurationMs,
        text: s.caption,
      });
    }
    outCursor += s.outDurationMs;
  }

  for (const step of steps) {
    const sped = step.playback_speed && step.playback_speed > 1;
    if (sped || !step.narration) continue;
    const start = rawToOutputMs(step.audio_start_ms ?? 0, segs);
    const end = start + (step.audio_duration_ms ?? 2000);
    cues.push({ start, end, text: wrapCaption(step.narration) });
  }

  cues.sort((a, b) => a.start - b.start);
  const body = cues
    .map((c, i) =>
      [String(i + 1), `${msToSrtTime(c.start)} --> ${msToSrtTime(c.end)}`, c.text, ''].join('\n'),
    )
    .join('\n');
  fs.writeFileSync(srtPath, body, 'utf-8');
}

const VIDEO_ENCODE = [
  '-c:v libx264 -preset fast -crf 23',
  '-pix_fmt yuv420p -profile:v high -level 4.0',
  '-bf 0 -vsync cfr -r 25',
].join(' ');
const AUDIO_ENCODE = '-c:a aac -b:a 128k -ar 48000 -ac 1';

/** Pass 1: render each coarse segment to mp4, concat → silent video. */
function buildSilentVideo(
  videoPath: string,
  trimMs: number,
  segs: TimelineSeg[],
  workDir: string,
): { silentPath: string; actualDurationsMs: number[] } {
  fs.mkdirSync(workDir, { recursive: true });
  const listPath = path.join(workDir, 'concat.txt');
  const actualDurationsMs: number[] = [];
  const lines: string[] = [];

  segs.forEach((s, i) => {
    const segPath = path.join(workDir, `seg_${String(i).padStart(3, '0')}.mp4`);
    let srcStart: number;
    let srcEnd: number;
    if (s.extractTailMs) {
      srcEnd = (trimMs + s.rawEndMs) / 1000;
      srcStart = (trimMs + s.rawEndMs - s.extractTailMs) / 1000;
    } else {
      srcStart = (trimMs + s.rawStartMs) / 1000;
      srcEnd = (trimMs + s.rawEndMs) / 1000;
    }
    const durSec = Math.max(0.05, srcEnd - srcStart);
    // -ss before -i for fast keyframe seek (critical on long Playwright webms)
    const cmd = [
      'ffmpeg -y -fflags +genpts',
      `-ss ${srcStart.toFixed(3)}`,
      `-i "${videoPath}"`,
      `-t ${durSec.toFixed(3)}`,
      '-map 0:v:0 -an',
      VIDEO_ENCODE,
      `"${segPath}"`,
    ].join(' ');
    console.log(
      `   ✂  seg ${i}: raw ${s.rawStartMs}-${s.rawEndMs}ms` +
        (s.extractTailMs ? ` (keep tail ${s.extractTailMs}ms)` : '') +
        ` → ${path.basename(segPath)}`,
    );
    run(cmd, true);
    const dur = probeDurationMs(segPath) ?? s.outDurationMs;
    actualDurationsMs.push(dur);
    // concat demuxer wants forward slashes
    lines.push(`file '${segPath.replace(/'/g, "'\\''")}'`);
  });

  fs.writeFileSync(listPath, lines.join('\n') + '\n', 'utf-8');
  const silentPath = path.join(workDir, 'silent.mp4');
  run(
    `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy -movflags +faststart "${silentPath}"`,
    true,
  );
  return { silentPath, actualDurationsMs };
}

/** Rebuild segs.outDurationMs from probed files; fix mapping drift. */
function applyActualDurations(segs: TimelineSeg[], actual: number[]): void {
  for (let i = 0; i < segs.length; i++) {
    if (actual[i] != null && actual[i]! > 0) segs[i]!.outDurationMs = actual[i]!;
  }
}

function buildAudioFilterFromDelays(
  clips: { id: string; file: string; delayMs: number }[],
  videoDurationSec: number,
): { inputs: string[]; filter: string } {
  if (clips.length === 0) {
    return {
      inputs: [],
      filter: `anullsrc=r=48000:cl=mono,atrim=0:${videoDurationSec.toFixed(3)},asetpts=PTS-STARTPTS[aout]`,
    };
  }
  const inputs: string[] = [];
  const labels: string[] = [];
  clips.forEach((c, i) => {
    inputs.push(`-i "${c.file}"`);
    labels.push(`[${i + 1}:a]adelay=${c.delayMs}|${c.delayMs}[a${i}]`);
    console.log(`   🔊 ${c.id} @ ${(c.delayMs / 1000).toFixed(2)}s`);
  });
  const mixInputs = clips.map((_, i) => `[a${i}]`).join('');
  const mix =
    `${mixInputs}amix=inputs=${clips.length}:duration=longest:dropout_transition=0:normalize=0[amix]`;
  const trim = `[amix]atrim=0:${videoDurationSec.toFixed(3)},asetpts=PTS-STARTPTS[aout]`;
  return { inputs, filter: [...labels, mix, trim].join('; ') };
}

function buildAudioFilter(
  audioSteps: FlowStep[],
  segs: TimelineSeg[],
  videoDurationSec: number,
): { inputs: string[]; filter: string } {
  const clips = audioSteps
    .filter((s) => {
      const sped = s.playback_speed && s.playback_speed > 1;
      return !sped && !s.offrecord && s.audio_file && s.audio_duration_ms;
    })
    .map((step) => ({
      id: step.id,
      file: step.audio_file!,
      delayMs: Math.max(0, Math.round(rawToOutputMs(step.audio_start_ms ?? 0, segs))),
    }));
  return buildAudioFilterFromDelays(clips, videoDurationSec);
}

function makeSlateMp4(
  workDir: string,
  width: number,
  height: number,
  durationSec: number,
): string {
  const slatePath = path.join(workDir, 'slate.mp4');
  // Solid slate; caption burned later via SRT (avoids drawtext CJK font issues).
  run(
    [
      'ffmpeg -y',
      `-f lavfi -i color=c=0x0f172a:s=${width}x${height}:d=${durationSec.toFixed(3)}:r=25`,
      VIDEO_ENCODE,
      `"${slatePath}"`,
    ].join(' '),
    true,
  );
  return slatePath;
}

function encodePartToMp4(
  inputPath: string,
  trimStartMs: number,
  outPath: string,
): number {
  const ss = trimStartMs > 0 ? `-ss ${(trimStartMs / 1000).toFixed(3)}` : '';
  run(
    [
      'ffmpeg -y -fflags +genpts',
      ss,
      `-i "${inputPath}"`,
      '-map 0:v:0 -an',
      VIDEO_ENCODE,
      `"${outPath}"`,
    ].join(' '),
    true,
  );
  return probeDurationMs(outPath) ?? 0;
}

/** Segmented path: part0 + 【视频加速中】slate + part1 (+ …). */
function assembleSegmented(
  flow: Flow,
  finalDir: string,
  finalPath: string,
  workDir: string,
): void {
  const parts = flow.video_parts!;
  const viewport = flow.viewport ?? { width: 1440, height: 900 };
  const slateMs = flow.accel_slate_ms ?? ACCEL_KEEP_MS;
  const off = flow.steps.find((s) => s.offrecord || s.record_part === -1);
  const caption = off?.accelerate_caption ?? '【视频加速中】';

  console.log(`   📼 Segmented: ${parts.length} parts + ${(slateMs / 1000).toFixed(1)}s slate`);

  const mp4s: string[] = [];
  const partDurations: number[] = [];
  const listLines: string[] = [];

  parts.forEach((p, i) => {
    if (!fs.existsSync(p.file)) {
      throw new Error(`Missing video part: ${p.file}`);
    }
    const out = path.join(workDir, `part_${i}.mp4`);
    const dur = encodePartToMp4(p.file, p.trim_start_ms ?? 0, out);
    console.log(`   ✂  part${i}: ${(dur / 1000).toFixed(1)}s ← ${path.basename(p.file)}`);
    mp4s.push(out);
    partDurations.push(dur);
  });

  // Insert slate after part0 (between pre-LLM and post-LLM)
  const slatePath = makeSlateMp4(workDir, viewport.width, viewport.height, slateMs / 1000);
  const slateDur = probeDurationMs(slatePath) ?? slateMs;

  const concatOrder: string[] = [];
  if (mp4s[0]) concatOrder.push(mp4s[0]);
  concatOrder.push(slatePath);
  for (let i = 1; i < mp4s.length; i++) concatOrder.push(mp4s[i]!);

  const listPath = path.join(workDir, 'concat.txt');
  fs.writeFileSync(
    listPath,
    concatOrder.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n',
  );
  const silentPath = path.join(workDir, 'silent.mp4');
  run(
    `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy -movflags +faststart "${silentPath}"`,
    true,
  );
  const silentDur = probeDurationMs(silentPath) ?? 0;
  console.log(`   Silent video: ${(silentDur / 1000).toFixed(1)}s`);

  // Timeline offsets for audio / SRT
  const part0Dur = partDurations[0] ?? 0;
  const partOffsets: number[] = [0];
  // after slate
  let cursor = part0Dur + slateDur;
  for (let i = 1; i < partDurations.length; i++) {
    partOffsets[i] = cursor;
    cursor += partDurations[i]!;
  }

  type Cue = { start: number; end: number; text: string };
  const cues: Cue[] = [];
  cues.push({ start: part0Dur, end: part0Dur + slateDur, text: caption });

  const clips: { id: string; file: string; delayMs: number }[] = [];
  for (const step of flow.steps) {
    if (step.offrecord || step.record_part === -1) continue;
    if (!step.audio_file || !step.audio_duration_ms || !step.narration) continue;
    const part = step.record_part ?? 0;
    const base = partOffsets[part] ?? 0;
    const delayMs = Math.max(0, Math.round(base + (step.audio_start_ms ?? 0)));
    clips.push({ id: step.id, file: step.audio_file, delayMs });
    cues.push({
      start: delayMs,
      end: delayMs + step.audio_duration_ms,
      text: wrapCaption(step.narration),
    });
  }

  cues.sort((a, b) => a.start - b.start);
  const srtPath = path.join(finalDir, `${flow.output_name}.srt`);
  fs.writeFileSync(
    srtPath,
    cues
      .map(
        (c, i) =>
          `${i + 1}\n${msToSrtTime(c.start)} --> ${msToSrtTime(c.end)}\n${c.text}\n`,
      )
      .join('\n'),
    'utf-8',
  );
  console.log(`   Subtitles: ${srtPath}`);

  const videoDurSec = silentDur / 1000;
  const { inputs, filter: audioFilter } = buildAudioFilterFromDelays(clips, videoDurSec);
  muxSilentWithAudioSubs(silentPath, inputs, audioFilter, srtPath, finalPath);
}

function muxSilentWithAudioSubs(
  silentPath: string,
  audioInputs: string[],
  audioFilter: string,
  srtPath: string,
  finalPath: string,
): void {
  const fontName =
    process.env.SUBTITLE_FONT ??
    (process.platform === 'darwin' ? 'PingFang SC' : 'Noto Sans CJK SC');
  const srtForFilter = escapeSubtitlesPath(srtPath);
  const forceStyle = [
    `FontName=${fontName}`,
    'FontSize=20',
    'PrimaryColour=&H00FFFFFF&',
    'OutlineColour=&H80000000&',
    'BackColour=&H80000000&',
    'BorderStyle=3',
    'Outline=1',
    'Shadow=0',
    'Alignment=2',
    'MarginV=42',
  ].join(',');
  const videoFilter = `[0:v]subtitles='${srtForFilter}':force_style='${forceStyle}'[vout]`;
  const filterComplex = `${videoFilter}; ${audioFilter}`;

  console.log(`\n   Pass 2/2: mix narration + burn subtitles...`);
  const cmd = [
    'ffmpeg -y',
    `-i "${silentPath}"`,
    audioInputs.join(' '),
    `-filter_complex "${filterComplex}"`,
    '-map "[vout]"',
    '-map "[aout]"',
    VIDEO_ENCODE,
    AUDIO_ENCODE,
    '-movflags +faststart',
    '-shortest',
    `"${finalPath}"`,
  ].join(' ');

  try {
    run(cmd);
  } catch {
    console.warn('⚠️  Subtitle burn failed; muxing audio without burn-in...');
    run(
      [
        'ffmpeg -y',
        `-i "${silentPath}"`,
        audioInputs.join(' '),
        `-filter_complex "${audioFilter}"`,
        '-map 0:v',
        '-map "[aout]"',
        '-c:v copy',
        AUDIO_ENCODE,
        '-movflags +faststart',
        '-shortest',
        `"${finalPath}"`,
      ].join(' '),
    );
  }
}

async function main(): Promise<void> {
  const enrichedFlowPath = process.argv[2];
  if (!enrichedFlowPath) {
    console.error('Usage: tsx scripts/assemble.ts <flow.enriched.json>');
    process.exit(1);
  }

  checkFFmpeg();

  const flow = JSON.parse(fs.readFileSync(enrichedFlowPath, 'utf-8')) as Flow;
  const lang = detectLangFromFlow(enrichedFlowPath);
  const root = projectRootFromFlow(enrichedFlowPath);
  const paths = projectPaths(root, flow.output_name, lang);
  const finalDir = paths.final!;
  fs.mkdirSync(finalDir, { recursive: true });

  const audioSteps = flow.steps.filter((s) => s.audio_file && s.audio_duration_ms);
  if (audioSteps.length === 0) {
    console.error('❌ No audio steps found. Run generate-audio first.');
    process.exit(1);
  }

  const finalPath = path.join(finalDir, `${flow.output_name}.mp4`);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vdb-assemble-'));

  console.log(`🎞  Assembling: "${flow.title}"`);
  console.log(`   Audio tracks: ${audioSteps.length}`);
  console.log(`   Output: ${finalPath}`);

  try {
    const useParts = (flow.video_parts?.length ?? 0) >= 1 && flow.steps.some((s) => s.offrecord || s.record_part === -1);
    if (useParts && flow.video_parts && flow.video_parts.length >= 2) {
      console.log(`\n   Pass 1/2: concat parts + accelerate slate...`);
      assembleSegmented(flow, finalDir, finalPath, workDir);
    } else {
      // Legacy single-webm + jump-cut path
      const videoPath = path.join(paths.raw!, `${flow.output_name}.webm`);
      if (!fs.existsSync(videoPath)) {
        const rawDir = paths.raw!;
        const webms = fs.readdirSync(rawDir).filter((f) => f.endsWith('.webm'));
        if (webms.length === 0) {
          console.error(`❌ No video found in ${rawDir}. Run generate-video first.`);
          process.exit(1);
        }
        webms.sort();
        const found = path.join(rawDir, webms[webms.length - 1]!);
        fs.renameSync(found, videoPath);
        console.log(`   Renamed ${found} → ${videoPath}`);
      }

      const trimMs = flow.trim_start_ms ?? 0;
      const probed = probeDurationMs(videoPath);
      const fallbackEnd = Math.max(...flow.steps.map((s) => s.raw_end_ms ?? s.audio_start_ms ?? 0), 1);
      const videoDurationMs = Math.max((probed ?? fallbackEnd) - trimMs, fallbackEnd);
      const segs = buildSegments(flow.steps, videoDurationMs);
      const cuts = segs.filter((s) => s.extractTailMs);
      console.log(`   Video: ${videoPath}`);
      if (trimMs > 0) console.log(`   ✂️  Trim prefix ${(trimMs / 1000).toFixed(2)}s`);
      for (const s of cuts) {
        const raw = (s.rawEndMs - s.rawStartMs) / 1000;
        console.log(
          `   ⚡ Jump-cut wait: ${raw.toFixed(1)}s → ${(s.outDurationMs / 1000).toFixed(1)}s (${s.caption})`,
        );
      }

      console.log(`\n   Pass 1/2: build silent video (${segs.length} segments)...`);
      const { silentPath, actualDurationsMs } = buildSilentVideo(videoPath, trimMs, segs, workDir);
      applyActualDurations(segs, actualDurationsMs);
      const silentDur = probeDurationMs(silentPath);
      console.log(`   Silent video: ${((silentDur ?? 0) / 1000).toFixed(1)}s`);

      const srtPath = path.join(finalDir, `${flow.output_name}.srt`);
      writeSrt(flow.steps, segs, srtPath);
      console.log(`   Subtitles: ${srtPath}`);

      const videoDurSec = (silentDur ?? segs.reduce((a, s) => a + s.outDurationMs, 0)) / 1000;
      const { inputs, filter: audioFilter } = buildAudioFilter(audioSteps, segs, videoDurSec);
      muxSilentWithAudioSubs(silentPath, inputs, audioFilter, srtPath, finalPath);
    }
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  const stats = fs.statSync(finalPath);
  const dur = probeDurationMs(finalPath);
  console.log(
    `\n✅ Final video: ${finalPath} (${(stats.size / 1024 / 1024).toFixed(1)} MB, ${((dur ?? 0) / 1000).toFixed(1)}s)`,
  );

  const thumbPath = path.join(finalDir, `${flow.output_name}-thumb.jpg`);
  try {
    run(`ffmpeg -y -i "${finalPath}" -ss 00:00:05 -vframes 1 -q:v 2 "${thumbPath}"`, true);
    console.log(`   Thumbnail: ${thumbPath}`);
  } catch {
    // Non-critical
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
