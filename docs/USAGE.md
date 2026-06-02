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

构建成功后，CLI 可执行文件位于 `dist/cli.js`。可选择全局链接：

```bash
pnpm link --global
# 之后任意目录可直接使用 airiclaw 命令
```

或者直接通过 node 运行：

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
# 一次性对话（输出完毕自动退出）
airiclaw chat "帮我总结一下 TypeScript 5.7 的新特性"

# 交互式 REPL（不传参数进入聊天模式）
airiclaw chat
```

交互模式下输入 `exit` 或 `quit` 退出。对话过程中 AI 的回复会**流式输出**到终端。

### `airiclaw skills` — 技能管理

```bash
# 列出所有技能
airiclaw skills list

# 仅列出用户可主动调用的技能
airiclaw skills list -i

# 搜索技能（模糊匹配名称+描述）
airiclaw skills search weather
airiclaw skills search "视频"
```

### `airiclaw serve` — 启动 Gateway 服务

```bash
# 默认端口 18789
airiclaw serve

# 自定义端口
airiclaw serve --port 9000
```

启动后，任何 WebSocket 客户端可连接 `ws://localhost:18789`，通过 OpenClaw 协议 v4 帧格式通信：

```json
// 发送请求
{"type":"req","id":"1","method":"chat","params":{"text":"你好"}}

// 收到响应
{"type":"res","id":"1","ok":true,"payload":{"text":"你好！有什么我能帮你的吗？"}}

// 实时事件（自动推送到所有客户端）
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

### `airiclaw status` — 查看当前状态

```bash
airiclaw status
```

输出当前生效的配置（合并了文件配置 + 环境变量后的最终值）。

---

## 配置

### 配置文件

`.airiclaw/config.json`（项目目录下）。所有字段都有默认值，文件可以只写你想覆盖的部分。

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

### 思考模式说明

DeepSeek V4 Pro 支持三种模式：

| 模式 | 说明 | 适用场景 |
|---|---|---|
| `non_think` | 不输出思考过程，直接回答 | 简单问答，追求速度 |
| `think_high` | 中等思考深度（默认） | 日常使用，平衡质量与速度 |
| `think_max` | 最深度思考，输出完整推理链 | 复杂推理、代码分析、数学 |

---

## 技能（Skills）

### 什么是技能

技能是用 `SKILL.md` 文件描述的能力模块。AI 在对话中判断需要某个技能时会自动调用它——具体做法是把技能的 Markdown 正文作为操作指南喂给模型（渐进式披露，而非一次性加载所有指南）。

### 技能目录结构

```
.airiclaw/skills/
├── web-fetch/
│   └── SKILL.md
├── calculator/
│   └── SKILL.md
└── git-helper/
    └── SKILL.md
```

每个技能是一个文件夹，内含一个 `SKILL.md`。

### 编写一个技能

```markdown
---
name: my-skill
description: 一句话描述这个技能做什么
metadata:
  openclaw:
    emoji: "🔧"
    requires:
      bins: ["curl"]          # 需要的命令行工具
      env: ["MY_API_KEY"]     # 需要的环境变量
    install:
      - id: brew
        kind: brew
        formula: curl
        bins: ["curl"]
        label: "Install curl (Homebrew)"
---

# My Skill

这里写技能的详细操作指南，AI 调用这个技能时会看到这些内容。

## Workflow

1. 第一步做什么
2. 第二步做什么

## Guardrails

- 不要做什么
- 注意什么
```

### Frontmatter 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 技能名（可省略，从目录名推断） |
| `description` | string | 一句话描述 |
| `user-invocable` | boolean | 是否允许用户直接列出/调用 |
| `disable-model-invocation` | boolean | `true` 则 AI 看不到此技能 |
| `metadata.openclaw.emoji` | string | 显示用的 emoji |
| `metadata.openclaw.requires.bins` | string[] | 依赖的命令行工具 |
| `metadata.openclaw.requires.env` | string[] | 依赖的环境变量 |
| `metadata.openclaw.install` | array | 安装方式（brew/node/go/uv/download） |
| `metadata.openclaw.primaryEnv` | string | 主要环境变量名 |

### 使用示例中的技能

```bash
# 指向 examples 目录中附带的示例技能
AIRICLAW_SKILLS_DIR=examples/skills airiclaw skills list
AIRICLAW_SKILLS_DIR=examples/skills airiclaw chat "fetch https://example.com"
```

---

## 角色卡（Character Card）

### 默认角色

AIRIClaw 内置了名为 "AIRI" 的默认角色，无需任何配置即可使用。

### 自定义角色

创建一个 JSON 文件（参考 `examples/character/airi.json`）：

```json
{
  "name": "小助手",
  "version": "1.0.0",
  "description": "一个专注于编程的本地助手",
  "personality": "逻辑清晰，回答简洁直接。",
  "scenario": "用户在本地终端中与助手对话，主要讨论编程问题。",
  "greetings": ["你好！今天写什么代码？"],
  "systemPrompt": "你是一个编程助手，擅长 TypeScript 和系统设计。",
  "postHistoryInstructions": "回答时优先给出代码示例。",
  "modules": {
    "consciousness": { "provider": "deepseek", "model": "deepseek-v4-pro" }
  }
}
```

在 `.airiclaw/config.json` 中指定路径：

```json
{
  "characterPath": "./my-character.json"
}
```

### 角色卡字段

| 字段 | 说明 |
|---|---|
| `name` | 角色名 |
| `personality` | 性格描述（注入 system prompt） |
| `scenario` | 场景设定 |
| `greetings` | 开场白（REPL 模式显示） |
| `systemPrompt` | 核心系统提示词 |
| `postHistoryInstructions` | 追加在对话末尾的指令 |
| `modules.consciousness` | LLM 配置 |
| `modules.speech` | 语音合成配置（TTS provider/voiceId） |
| `modules.avatar` | 头像配置（Live2D/VRM 源） |

---

## 记忆系统

AIRIClaw 自动在 `memoryDir`（默认 `.airiclaw/memory/`）中维护：

```
.airiclaw/memory/
├── MEMORY.md         # 长期记忆（手动或程序追加）
├── DREAMS.md         # 梦境/灵感笔记
└── daily/
    ├── 2026-06-01.md # 每日对话记录
    ├── 2026-06-02.md
    └── ...
```

- **每次对话**自动追加到当日的 daily note。
- **每次提问**时，系统从 `MEMORY.md` 中做关键词召回，把相关记忆注入 system prompt。
- 你可以**手动编辑** `MEMORY.md` 写入长期知识（如个人偏好、项目信息）。

---

## 程序化调用（Library API）

AIRIClaw 也可以作为 npm 包在你自己的项目中使用：

```ts
import { Assistant, loadConfig, EventBus } from 'airiclaw'

// 加载配置
const config = await loadConfig()

// 创建助手实例
const assistant = new Assistant({ config })
await assistant.loadSkills()

// 监听事件（用于接入前端/语音）
assistant.events.on('output:gen-ai:chat:delta', ({ delta }) => {
  process.stdout.write(delta)  // 流式文字
})

assistant.events.on('output:gen-ai:chat:complete', ({ message, usage }) => {
  console.log(`\n[tokens: ${usage.totalTokens}]`)
})

// 对话
const { text } = await assistant.chat('你好！')
console.log(text)
```

### 接入数字人前端

如果你有 Live2D/VRM 渲染器，通过事件接入：

```ts
// 口型同步
assistant.events.on('output:lipsync', ({ mouthOpen, vowel }) => {
  avatar.setMouthOpen(mouthOpen) // 0~1
})

// 表情
assistant.events.on('output:emotion', ({ emotion, intensity }) => {
  avatar.setExpression(emotion, intensity)
})

// 语音播放
assistant.events.on('output:speech', ({ audio, text }) => {
  audioPlayer.play(audio)
})
```

### Gateway 客户端

连接 Gateway 进行远程调用：

```ts
import WebSocket from 'ws'

const ws = new WebSocket('ws://localhost:18789')

ws.on('open', () => {
  // 发送 chat 请求
  ws.send(JSON.stringify({
    type: 'req',
    id: '1',
    method: 'chat',
    params: { text: '今天天气怎么样？' }
  }))
})

ws.on('message', (data) => {
  const frame = JSON.parse(data.toString())
  if (frame.type === 'res') {
    console.log('回复:', frame.payload.text)
  }
  if (frame.type === 'event') {
    console.log('事件:', frame.event, frame.payload)
  }
})
```

---

## 运行测试

```bash
pnpm test          # 运行所有 78 个测试
pnpm test:watch    # 监听模式
```

---

## 常见问题

### Q: 提示 "no DEEPSEEK_API_KEY set"

设置环境变量：`export DEEPSEEK_API_KEY=sk-...`

### Q: 没有技能被发现

确认 `skillsDir` 路径下有 `*/SKILL.md` 文件。可用 `airiclaw status` 查看当前 skillsDir 指向哪里。

### Q: 想用 DeepSeek V4 Flash（更快更便宜）

```bash
export AIRICLAW_MODEL=deepseek-v4-flash
```

或在 `.airiclaw/config.json` 中：
```json
{ "llm": { "model": "deepseek-v4-flash" } }
```

### Q: 想用其他 OpenAI 兼容 API（如 OpenRouter）

```bash
export AIRICLAW_BASE_URL=https://openrouter.ai/api/v1
export DEEPSEEK_API_KEY=sk-or-...
export AIRICLAW_MODEL=deepseek/deepseek-chat
```

### Q: Gateway 怎么做身份验证

当前版本的 Gateway 不含鉴权（仅监听 localhost）。生产部署请自行在前面加反向代理（nginx/caddy）+ token 校验。

---

## 项目结构一览

```
AIRIClaw/
├── src/
│   ├── llm/         # LLM 契约 + DeepSeek V4 Pro provider
│   ├── agent/       # 流式 agent 循环 + 工具调度
│   ├── skills/      # SKILL.md 解析/注册/prompt 生成/工具适配
│   ├── character/   # 角色卡 + system prompt 构建
│   ├── memory/      # 长期记忆 + 每日笔记 + 关键词召回
│   ├── events/      # AIRI 协议事件总线
│   ├── gateway/     # OpenClaw v4 帧协议 + WebSocket 服务
│   ├── voice/       # TTS/STT/lip-sync 接口
│   ├── runtime/     # Assistant（融合层）
│   ├── config/      # 配置加载
│   ├── index.ts     # 库入口
│   └── cli.ts       # CLI 入口
├── examples/
│   ├── skills/      # 示例技能
│   └── character/   # 示例角色卡
├── dist/            # 构建产物
└── package.json
```
