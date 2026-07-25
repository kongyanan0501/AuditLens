# Patches over upstream `video-docs-builder`

上游默认：Playwright 录屏 + TTS + FFmpeg 混音。  
本 Skill 的 `vendor-scripts/` 是安永/AuditDraft 演示验证过的增强版。

## 一键打补丁

```bash
bash scripts/apply-patches.sh /path/to/video-docs-builder
# 默认从本 Skill 的 vendor-scripts/ 复制
```

覆盖文件：

| 文件 | 增强 |
| --- | --- |
| `types.ts` | `highlight` / `upload` / `wait_job_done` / `offrecord` / `upload_before` / `video_parts` / `accel_slate_ms` |
| `generate-video.ts` | 聚光灯；upload；`${email}`；**分段录制**（off-record LLM）；`upload_before` 重挂文件；`storageState` |
| `generate-audio.ts` | `TTS_PROVIDER=edge`；中文多音字纠音（行→条/记录） |
| `assemble.ts` | 烧录字幕；`video_parts`+垫片合成；legacy 跳切；播放器友好 H.264 |

## 能力说明

### 1. 聚光灯
旁白期间：`boundingBox` → 半透明遮罩挖洞 + 标签。结束后隐藏。

### 2. 分段录制（核心）
对 `wait_job_done` 且 `offrecord` / `playback_speed>1`：
1. 结束 Part0 录像并保存 cookie（`storageState`）
2. **无录像** context 里轮询任务完成（可自动点「重试」）
3. 新开 Part1 录像，时间戳从 0 计
4. assemble：`part0 + 2.5s 垫片【视频加速中】 + part1`

这样不可控耗时不进正片，后半段旁白不会被等待时长带偏。

离线段若要点「开始分析」类按钮：分段会新开页面，React 上传状态会丢。在该步设置 `upload_before` 为文件绝对路径，引擎会在 click 前重新 `setInputFiles`，并等待按钮可用。

### 3. Edge TTS + 纠音
`行级`→`记录级`，`N行`→`N条` 等，避免 hang/xíng 误读；`套壳`→`套咳`，强制 tào ké（四声+二声，仅影响语音，字幕仍显示原文）。

### 4. 底部字幕
生成 `.srt` 并用 ffmpeg `subtitles=` 烧录；失败则回退无字幕混音。

### 5. 上传
`action: "upload"` → `setInputFiles`。

## ffmpeg 本地链

```bash
cd video-docs-builder
npm i -D ffmpeg-static ffprobe-static
mkdir -p .bin
ln -sf "$(node -p "require('ffmpeg-static')")" .bin/ffmpeg
ln -sf "$(node -p "require('ffprobe-static').path")" .bin/ffprobe
export PATH="$(pwd)/.bin:$PATH"
```

## 环境变量

```bash
TTS_PROVIDER=edge
EDGE_TTS_VOICE=zh-CN-YunyangNeural
EDGE_TTS_RATE=+8%
EDGE_TTS_BIN=$HOME/Library/Python/3.10/bin/edge-tts
ACCEL_SLATE_MS=2500
SUBTITLE_FONT=PingFang SC
```
