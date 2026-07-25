---
name: web-walkthrough-video
description: >-
  End-to-end narrated web walkthrough videos: Playwright recording, Chinese TTS,
  spotlight highlights, burned-in subtitles, and off-record LLM wait slicing.
  Use when the user wants 网页操作讲解视频、产品演示录制、demo walkthrough with
  voiceover/subtitles, or to reuse this pipeline in another project.
---

# Web Walkthrough Video

把「真实浏览器操作 + 中文旁白 + 区域高亮 + 底部字幕」做成**可复用流水线**。  
本 Skill 是编排层；执行引擎是打过补丁的 `video-docs-builder`。

## 何时启用

用户说类似：
- 「做网页操作讲解 / 产品 walkthrough 视频」
- 「自动录屏 + 配音 + 字幕」
- 「等大模型时不要干等，切片/加速再继续讲」
- 「把这套能力带到别的项目」

## 依赖（引用的 Skill / 工具）

| 依赖 | 角色 | 安装 |
| --- | --- | --- |
| **video-docs-builder**（上游） | Playwright 录屏 + TTS + FFmpeg 管线骨架 | `npx skills add https://github.com/tecnomanu/video-docs-builder --skill video-docs-builder -y` |
| **本 Skill `vendor-scripts/`** | 已验证增强（高亮 / Edge TTS / 字幕 / 分段录制） | `bash scripts/apply-patches.sh <video-docs-builder>` |
| **edge-tts** | 免费中文旁白 | `python3 -m pip install --user edge-tts` |
| **ffmpeg + ffprobe**（含 libass） | 混音、垫片、烧录字幕 | 优先 `ffmpeg-static` / `ffprobe-static` → skill `.bin/` |
| **Playwright Chromium** | 浏览器录制 | 在 video-docs-builder 目录：`npx playwright install chromium` |

可选、**不必装**（仅对照）：
- `demo-video`：宣传片/截图合成，不是真操作录屏
- `playwright-recording`：只录素材，无旁白管线

详细补丁说明见 [patches.md](patches.md)；技巧与验收见 [reference.md](reference.md)。

## Agent 执行清单（新项目一次做完）

### 0. 目标应用就绪

1. App 已启动（如 `http://localhost:3000`）。
2. 准备演示账号、样本文件绝对路径。
3. 若流程含 LLM：确认额度可用；演示数据尽量用**小样**（可控耗时）。

### 1. 安装引擎 + 打补丁

```bash
# 在目标仓库或统一 skills 目录
npx skills add https://github.com/tecnomanu/video-docs-builder --skill video-docs-builder -y

# 用本 Skill 自带的已验证脚本覆盖上游
bash ~/.cursor/skills/web-walkthrough-video/scripts/apply-patches.sh \
  /path/to/video-docs-builder

# ffmpeg 本地二进制（推荐）
cd /path/to/video-docs-builder
npm i -D ffmpeg-static ffprobe-static
mkdir -p .bin
ln -sf "$(node -p "require('ffmpeg-static')")" .bin/ffmpeg
ln -sf "$(node -p "require('ffprobe-static').path")" .bin/ffprobe
npx playwright install chromium
```

也可一键：`bash ~/.cursor/skills/web-walkthrough-video/scripts/bootstrap.sh /path/to/target-app`

### 2. 初始化 `.video-docs`

```bash
cd /path/to/video-docs-builder
npx tsx scripts/init-project.ts /path/to/target-app
```

编辑 `target-app/.video-docs/config.json`（**gitignore，勿提交密钥**）：

```json
{
  "app_name": "MyApp",
  "base_url": "http://localhost:3000",
  "setup_login": { "email": "demo@example.com", "password": "secret" }
}
```

引擎 `.env`（video-docs-builder 根目录）：

```bash
TTS_PROVIDER=edge
EDGE_TTS_VOICE=zh-CN-YunyangNeural
EDGE_TTS_RATE=+8%
EDGE_TTS_BIN=$HOME/Library/Python/3.10/bin/edge-tts
# ACCEL_SLATE_MS=2500
# SUBTITLE_FONT=PingFang SC
```

### 3. 写 Flow 分镜

- 模板（简单）：[templates/flow.example.json](templates/flow.example.json)
- 模板（含 LLM 切片）：[templates/flow-with-llm-wait.example.json](templates/flow-with-llm-wait.example.json)

**硬技巧：**

1. **聚光灯**：每句旁白配 `highlight` + `highlight_label`。
2. **Timing**：先旁白「将要做什么」，再 `click`（可用前置 `wait` 步放旁白）。
3. **结果页旁白**：等 UI 稳定后再讲（`wait_for` 到标题/卡片），不要绑在耗时 `click+导航` 同一步末尾。
4. **不可控等待（LLM/长任务）必须切片**：
   - Part0 旁白结束 → `wait_job_done` + `offrecord: true`（**不进 webm**）
   - 合成插入垫片字幕 `【视频加速中】`
   - Part1 新开录制，**时间轴归零**，再讲结果
5. 中文避免「N行」等多音字歧义（补丁会纠音；文案也尽量写「条/记录」）。

### 4. 跑通流水线

```bash
cd /path/to/video-docs-builder
export PATH="$(pwd)/.bin:$PATH"
bash scripts/run-all.sh /path/to/target-app/.video-docs/flows/01-walkthrough.json
```

产出：
- `.video-docs/output/<name>/final/<name>.mp4`（旁白 + 高亮 + 烧录字幕）
- 同目录 `.srt`
- `raw/*.part0.webm`、`raw/*.part1.webm`（若启用了 off-record 切片）

增量：
- 只改合成：`--skip-audio --skip-video`（需已有 enriched + raw）
- 改了 flow 步骤：不要 `--skip-audio`，或删 `.enriched.json` 重跑
- **验收用 QuickTime / Chrome / VLC**（编辑器预览常冻在第一帧）

### 5. 质量门禁

- [ ] 系统作区有聚光灯
- [ ] LLM/长等待走 off-record + 垫片，后半段音画对齐
- [ ] 字幕贴底不挡主按钮
- [ ] 成片时长符合目标（常见 2–5 分钟）
- [ ] `config.json` / `.env` 未进 git

## 本 Skill 文件结构

```
web-walkthrough-video/
├── SKILL.md                 # 本文件（Agent 入口）
├── patches.md               # 相对上游改了什么
├── reference.md             # 技巧、音画同步、故障
├── scripts/
│   ├── apply-patches.sh     # 把 vendor-scripts 打进 video-docs-builder
│   └── bootstrap.sh         # 新项目一键初始化
├── vendor-scripts/          # 已验证的 generate-*/assemble/types
└── templates/               # flow / config 示例
```

## 与 AuditDraft 参考实现

本机完整跑通示例：
- Flow：`AuditDraft/.video-docs/flows/01-ey-full-demo.json`
- 引擎：`AuditDraft/.agents/skills/video-docs-builder/`
- 成片：`.video-docs/output/01-ey-full-demo/final/01-ey-full-demo.mp4`

更新 `vendor-scripts/` 时：从该引擎 `scripts/` 再拷一次四个文件即可。
