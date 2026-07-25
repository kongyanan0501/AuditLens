# Reference — 技巧、同步与故障

## 分镜 Timing

| 做法 | 原因 |
| --- | --- |
| 旁白在动作前：「接下来点击上传」→ 再 click | 观众跟得上 |
| 结果讲解用独立 `wait` + `wait_for` | 避免绑在慢导航末尾，空等十几秒才出声 |
| 静默步骤（fill）可不写 narration | 减少碎念 |
| `action_ms` 给 UI 动画留余量 | 高亮时页面已稳定 |

## 不可控耗时（LLM / 长任务）

**不要**把等待录进同一条时间轴再用 setpts 倍速——墙钟与 webm 时钟一偏，后半段会整体快/慢数秒到十几秒。

**要**用 off-record 切片：

```
Part0（录）→ wait_job_done offrecord（不录）→ 垫片 2.5s → Part1（录，时间轴 0）
```

Part1 内旁白 `audio_start_ms` 只相对 Part1，与 LLM 实际耗时无关。

## 聚光灯选择器

- 优先 Playwright：`h2:has-text("标题")`、`section:has(input[name="file"])`
- 旁白时元素必须仍可见；导航后旧 selector 会 miss
- 标签短：`登录表单`、`风险事项`

## 口播文案

- 短句、具体动作；少套话
- 「行」表条数时写「条/记录」
- 语速：`EDGE_TTS_RATE=+8%`；再慢 `+0%`
- 音色：`zh-CN-YunyangNeural`（男）/ `zh-CN-XiaoxiaoNeural`（女）

## 验收

1. **系统播放器**打开 mp4（Cursor 预览常冻第一帧）
2. 拖到垫片前后：旁白应贴着结果页出现
3. 对照 `.srt` 时间码与画面

## 故障速查

| 现象 | 处理 |
| --- | --- |
| 音画整体错位、音频偏快 | 是否未打分段补丁仍用旧 setpts？改用 off-record 重录 |
| highlight miss | 旁白时元素是否还在；改 selector |
| `--skip-audio` 步骤旧 | 同步/删除 `.enriched.json` |
| 字幕失败 | ffmpeg 需 libass；设 `SUBTITLE_FONT` |
| 任务列表一直失败 | 应用/API/额度问题；off-record 会重试「重试」按钮 |
| Homebrew ffmpeg 挂 | 用 `ffmpeg-static` → `.bin/` |
| 编辑器里「只有第一帧」 | 用 QuickTime 看，不是没录上 |

## Flow 字段速查

| 字段 | 含义 |
| --- | --- |
| `action` | navigate/fill/click/upload/wait/wait_job_done/scroll/… |
| `narration` | TTS 文本 |
| `highlight` / `highlight_label` | 聚光灯 |
| `wait_for` / `wait_for_url` / `wait_timeout_ms` | 等待 |
| `offrecord` | 不进录像；分段点 |
| `accelerate_caption` | 垫片字幕 |
| `${email}` / `${password}` | 来自 config.setup_login |
