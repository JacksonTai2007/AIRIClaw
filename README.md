# AIRIClaw

**A local-first Agent + digital-human assistant.** AIRIClaw fuses the agent /
skill / gateway runtime of [OpenClaw](https://github.com/openclaw/openclaw)
(2026.6.2) with the character and event protocol of
[Project AIRI](https://github.com/moeru-ai/airi) (v0.10.2), powered by
**DeepSeek V4 Pro**.

It is a single, self-contained TypeScript monolith — not a bridge between two
apps. The pieces that matter are re-implemented from both projects' latest
source and wired into one runtime.

```
input:text ─▶ recall memory ─▶ build system prompt ─▶ DeepSeek agent loop ─▶ output:gen-ai:chat:*
                (AIRI memory)     (AIRI persona +          (OpenClaw           (AIRI protocol →
                                   OpenClaw skills)          agent-core)          avatar / voice)
```

> 📖 **完整使用文档见 [docs/USAGE.md](./docs/USAGE.md)** — 安装、配置、CLI 命令、技能编写、角色卡、记忆、Library API、Gateway 接入、常见问题。

## Features

- **DeepSeek V4 Pro** as the brain — OpenAI-compatible client with `non_think` /
  `think_high` / `think_max` thinking modes, 1M-token context, streaming with
  reasoning deltas.
- **Agent loop** (OpenClaw `agent-core`, 2026.6.2 event names): streaming,
  tool-calling, iterates until the model stops requesting tools; sequential or
  parallel tool execution.
- **Skills** in OpenClaw's `SKILL.md` format — YAML frontmatter with
  `metadata.openclaw` (emoji / always / requires / install / skillKey), and
  upstream-faithful invocation policy (`user-invocable` defaults to *true*,
  `disable-model-invocation` hides a skill from the model). Skills become
  callable tools; invoking one feeds its `SKILL.md` body back to the model
  (progressive disclosure). `always` skills are inlined into the system prompt.
- **Character / persona** from an AIRI-style character card (personality,
  scenario, greetings, system prompt, avatar & speech modules).
- **Memory**: `MEMORY.md`, `DREAMS.md`, and dated daily notes, with keyword
  recall injected into the system prompt every turn.
- **AIRI protocol events** (`input:text`, `output:gen-ai:chat:*`,
  `output:emotion`, `output:lipsync`, `output:speech`, `context:update`,
  `spark:*`) over a typed event bus — the seam where a digital-human frontend
  plugs in.
- **Gateway server** speaking OpenClaw's frame protocol **v4**
  (`req`/`res`/`event`) on port `18789`, with every protocol event fanned out
  to connected clients.
- **Voice / lip-sync interfaces** (`TTSProvider`, `STTProvider`,
  `LipSyncDriver`) with safe headless defaults, so an avatar layer has a
  contract to render against.

## Quick start

```bash
git clone https://github.com/JacksonTai2007/AIRIClaw.git
cd AIRIClaw
pnpm install
pnpm build      # tsup → dist/
pnpm test       # vitest

export DEEPSEEK_API_KEY=sk-...
node dist/cli.js chat "你好"
```

Requires Node ≥ 22.

## CLI

```bash
airiclaw chat [message]       # one-shot, or interactive REPL with no args
airiclaw skills list [-i]     # list skills (-i: user-invocable only)
airiclaw skills search <q>    # search model-invocable skills
airiclaw serve [--port N]     # gateway server (protocol v4, default :18789)
airiclaw config init          # write .airiclaw/config.json
airiclaw status               # resolved config + provider info
```

## Library usage

```ts
import { Assistant, loadConfig } from 'airiclaw'

const assistant = new Assistant({ config: await loadConfig() })
await assistant.loadSkills()

assistant.events.on('output:gen-ai:chat:delta', ({ delta }) => process.stdout.write(delta))
assistant.events.on('output:lipsync', ({ mouthOpen }) => avatar.setMouth(mouthOpen))

const { text } = await assistant.chat('hello!')
```

## Architecture

One package under `src/`, organized by concern:

| Module | Origin | Responsibility |
| --- | --- | --- |
| `src/llm` | unified | Provider contract + `DeepSeekProvider` (V4 Pro) |
| `src/agent` | OpenClaw `agent-core` | Streaming agent loop + tool dispatch |
| `src/skills` | OpenClaw skills | `SKILL.md` parsing, registry, prompt, tool adapter |
| `src/character` | AIRI character card | Persona + system-prompt construction |
| `src/memory` | OpenClaw/AIRI memory | `MEMORY.md` / `DREAMS.md` / daily notes + recall |
| `src/events` | AIRI `plugin-protocol` | Typed protocol event bus |
| `src/gateway` | OpenClaw `gateway-protocol` | Frame protocol v4 + WebSocket server |
| `src/voice` | AIRI audio pipeline | TTS / STT / lip-sync interfaces |
| `src/runtime` | the fusion | `Assistant` — one conversational turn, end to end |
| `src/config` | — | Config schema + loader |
| `src/cli.ts` | — | `chat` / `skills` / `serve` / `config` / `status` |

Examples live under `examples/` (a sample skill and character card).

## Status

Headless core: complete, builds, fully tested. The digital-human frontend
(Live2D/VRM rendering, real TTS/STT) is intentionally an interface — connect
any renderer to the `output:*` events.

## License

MIT
