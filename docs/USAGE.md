# AIRIClaw 使用文档

## 快速开始

### 环境要求

- **Node.js ≥ 22**（推荐 Node 24）
- **pnpm**（`npm install -g pnpm`）
- **DeepSeek API Key**（在 [platform.deepseek.com](https://platform.deepseek.com) 获取）

### 安装

```bash
git clone https://github.com/JacksonTai2007/AIRIClaw.git
cd AIRIClaw
pnpm install
pnpm build
```

构建产物在 `dist/`。可全局链接：

```bash
pnpm link --global
# 之后任意目录可直接使用 airiclaw 命令
```

或直接运行：

```bash
node dist/cli.js <command>
```

### 设置 API Key

```bash
export DEEPSEEK_API_KEY="sk-your-key-here"
```

建议写入 `~/.bashrc` 或 `~/.zshrc`。

---

## CLI 命令

### `airiclaw chat` — 对话

```bash
# 一次性对话（输出完自动退出）
airiclaw chat "帮我总结一下 TypeScript 5.9 的新特性"

# 交互式 REPL（不传参数进入聊天模式）
airiclaw chat
```

交互模式输入 `exit` / `quit` 退出。回复**流式输出**到终端。

### `airiclaw skills` — 技能管理

```bash
airiclaw skills list          # 列出所有技能
airiclaw skills list -i       # 仅列出用户可主动调用的技能
airiclaw skills search 天气   # 模糊搜索（名称+描述）
```

### `airiclaw serve` — 启动 Gateway 服务

```bash
airiclaw serve                # 默认端口 18789
airiclaw serve --port 9000    # 自定义端口
```

启动后任何 WebSocket 客户端可连接 `ws://localhost:18789`，使用 OpenClaw 协议 v4 帧格式：

```json
// 请求
{"type":"req","id":"1","method":"chat","params":{"text":"你好"}}

// 响应
{"type":"res","id":"1","ok":true,"payload":{"text":"你好！有什么我能帮你的吗？"}}

// 实时事件（自动推送给所有客户端）
{"type":"event","event":"output:gen-ai:chat:delta","payload":{"delta":"你"},"seq":1}
```

### `airiclaw config init` — 初始化配置

```bash
airiclaw config init
```

在当前目录生成 `.airiclaw/config.json`：

```json
{
  "llm": {
    "provider": "deepseek",
    "model": "deepseek-v4-pro",
    "baseURL": "https://api.deepseek.com",
    "thinkingMode": "think_high",
    "temperature": 0.7
  },
  "skillsDir": ".airiclaw/skills",
  "memoryDir": ".airiclaw/memory",
  "gatewayPort": 18789,
  "maxTurns": 12
}
```

### `airiclaw status` — 查看状态

输出合并文件配置 + 环境变量后的最终生效配置。

---

## 配置

### 环境变量

| 环境变量 | 作用 | 默认值 |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（**必需**） | — |
| `AIRICLAW_MODEL` | 模型 ID | `deepseek-v4-pro` |
| `AIRICLAW_BASE_URL` | API 基础 URL | `https://api.deepseek.com` |
| `AIRICLAW_THINKING_MODE` | 思考模式 | `think_high` |
| `AIRICLAW_GATEWAY_PORT` | Gateway 端口 | `18789` |
| `AIRICLAW_SKILLS_DIR` | 技能目录 | `.airiclaw/skills` |
| `AIRICLAW_MEMORY_DIR` | 记忆目录 | `.airiclaw/memory` |

### 思考模式

DeepSeek V4 Pro 支持三种模式：

| 模式 | 说明 | 适用场景 |
|---|---|---|
| `non_think` | 不思考直接回答 | 简单问答，追求速度 |
| `think_high` | 中等思考深度（默认） | 日常使用，质量与速度平衡 |
| `think_max` | 最深度思考 | 复杂推理、代码分析、数学 |

---

## 技能（Skills）

### 工作原理

技能用 `SKILL.md` 描述。AI 判断需要某技能时会调用对应工具，系统把技能的
Markdown 正文作为操作指南喂给模型（渐进式披露——不会一次性把所有指南塞进
prompt）。标记 `always: true` 的技能例外：它们的全文会直接进入 system prompt。

### 目录结构

```
.airiclaw/skills/
├── web-fetch/
│   └── SKILL.md
└── calculator/
    └── SKILL.md
```

### 编写一个技能

```markdown
---
name: my-skill
description: 一句话描述这个技能做什么
metadata:
  openclaw:
    emoji: "🔧"
    requires:
      bins: ["curl"]          # 依赖的命令行工具
      env: ["MY_API_KEY"]     # 依赖的环境变量
    install:
      - id: brew
        kind: brew
        formula: curl
        bins: ["curl"]
        label: "Install curl (Homebrew)"
---

# My Skill

这里写详细操作指南，AI 调用技能时会读到。

## Workflow

1. 第一步
2. 第二步

## Guardrails

- 禁止事项
```

### Frontmatter 字段

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `name` | string | 从目录名推断 | 技能名 |
| `description` | string | `''` | 一句话描述 |
| `user-invocable` | boolean | **`true`** | 是否允许用户直接调用 |
| `disable-model-invocation` | boolean | `false` | `true` 则 AI 看不到此技能 |
| `metadata.openclaw.always` | boolean | — | `true` 则全文常驻 system prompt |
| `metadata.openclaw.emoji` | string | — | 展示 emoji |
| `metadata.openclaw.skillKey` | string | — | 备用调用键名 |
| `metadata.openclaw.primaryEnv` | string | — | 主要环境变量名 |
| `metadata.openclaw.requires.bins` | string[] | — | 依赖的命令行工具 |
| `metadata.openclaw.requires.env` | string[] | — | 依赖的环境变量 |
| `metadata.openclaw.install` | array | — | 安装方式（brew/node/go/uv/download） |

### 试用示例技能

```bash
AIRICLAW_SKILLS_DIR=examples/skills airiclaw skills list
AIRICLAW_SKILLS_DIR=examples/skills airiclaw chat "fetch https://example.com"
```

---

## 角色卡（Character Card）

### 默认角色

内置名为 "AIRI" 的默认角色，开箱即用。

### 自定义角色

创建 JSON 文件（参考 `examples/character/airi.json`）：

```json
{
  "name": "小助手",
  "personality": "逻辑清晰，回答简洁直接。",
  "scenario": "用户在本地终端与助手讨论编程问题。",
  "greetings": ["你好！今天写什么代码？"],
  "systemPrompt": "你是一个编程助手，擅长 TypeScript 和系统设计。",
  "postHistoryInstructions": "回答时优先给出代码示例。",
  "modules": {
    "consciousness": { "provider": "deepseek", "model": "deepseek-v4-pro" }
  }
}
```

在 `.airiclaw/config.json` 中指定：

```json
{ "characterPath": "./my-character.json" }
```

### 字段说明

| 字段 | 说明 |
|---|---|
| `name` | 角色名 |
| `personality` | 性格描述（注入 system prompt） |
| `scenario` | 场景设定 |
| `greetings` | 开场白（REPL 模式显示第一条） |
| `systemPrompt` | 核心系统提示词 |
| `postHistoryInstructions` | 追加在最后的指令 |
| `modules.consciousness` | LLM 配置 |
| `modules.speech` | 语音合成配置（provider/voiceId 等） |
| `modules.avatar` | 头像配置（live2d/vrm + file/url） |

---

## 记忆系统

自动维护在 `memoryDir`（默认 `.airiclaw/memory/`）：

```
.airiclaw/memory/
├── MEMORY.md         # 长期记忆（可手动编辑）
├── DREAMS.md         # 梦境/灵感笔记
└── daily/
    └── 2026-06-10.md # 每日对话记录
```

- 每次对话自动写入当日 daily note。
- 每次提问会从 `MEMORY.md` 做关键词召回，相关条目注入 system prompt。
- 可手动编辑 `MEMORY.md` 写入长期知识（个人偏好、项目信息等）。

---

## 程序化调用（Library API）

```ts
import { Assistant, loadConfig } from 'airiclaw'

const assistant = new Assistant({ config: await loadConfig() })
await assistant.loadSkills()

// 流式文字
assistant.events.on('output:gen-ai:chat:delta', ({ delta }) => {
  process.stdout.write(delta)
})

// 回合完成（含 token 用量）
assistant.events.on('output:gen-ai:chat:complete', ({ usage }) => {
  console.log(`\n[tokens: ${usage.totalTokens}]`)
})

const { text } = await assistant.chat('你好！')
```

### 接入数字人前端

```ts
// 口型同步（0~1）
assistant.events.on('output:lipsync', ({ mouthOpen, vowel }) => {
  avatar.setMouthOpen(mouthOpen)
})

// 表情
assistant.events.on('output:emotion', ({ emotion, intensity }) => {
  avatar.setExpression(emotion, intensity)
})

// 语音播放
assistant.events.on('output:speech', ({ audio }) => {
  audioPlayer.play(audio)
})
```

### Gateway 客户端

```ts
import WebSocket from 'ws'

const ws = new WebSocket('ws://localhost:18789')

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'req', id: '1', method: 'chat',
    params: { text: '今天天气怎么样？' },
  }))
})

ws.on('message', (data) => {
  const frame = JSON.parse(data.toString())
  if (frame.type === 'res') console.log('回复:', frame.payload.text)
  if (frame.type === 'event') console.log('事件:', frame.event)
})
```

---

## 运行测试

```bash
pnpm test          # 全部测试
pnpm test:watch    # 监听模式
pnpm typecheck     # 类型检查
```

---

## 常见问题

**Q: 提示 "no DEEPSEEK_API_KEY set"**
设置环境变量：`export DEEPSEEK_API_KEY=sk-...`

**Q: 没有技能被发现**
确认 `skillsDir` 下有 `*/SKILL.md`。用 `airiclaw status` 查看当前目录指向。

**Q: 想用 DeepSeek V4 Flash（更快更便宜）**
`export AIRICLAW_MODEL=deepseek-v4-flash`，或在配置文件 `llm.model` 中设置。

**Q: 想接其他 OpenAI 兼容 API（如 OpenRouter）**
```bash
export AIRICLAW_BASE_URL=https://openrouter.ai/api/v1
export DEEPSEEK_API_KEY=sk-or-...
export AIRICLAW_MODEL=deepseek/deepseek-chat
```

**Q: Gateway 如何鉴权**
当前版本不含鉴权（建议仅监听 localhost）。生产部署请在前面加反向代理
（nginx/caddy）+ token 校验。

---

## 项目结构

```
AIRIClaw/
├── src/
│   ├── llm/         # LLM 契约 + DeepSeek V4 Pro provider
│   ├── agent/       # 流式 agent 循环 + 工具调度
│   ├── skills/      # SKILL.md 解析/注册/prompt/工具适配
│   ├── character/   # 角色卡 + system prompt 构建
│   ├── memory/      # 长期记忆 + 每日笔记 + 关键词召回
│   ├── events/      # AIRI 协议事件总线
│   ├── gateway/     # OpenClaw v4 帧协议 + WebSocket 服务
│   ├── voice/       # TTS/STT/lip-sync 接口
│   ├── runtime/     # Assistant（融合层）
│   ├── config/      # 配置加载
│   ├── index.ts     # 库入口
│   └── cli.ts       # CLI 入口
├── examples/        # 示例技能 + 角色卡
└── docs/USAGE.md    # 本文档
```
