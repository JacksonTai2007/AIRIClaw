# AIRIClaw

**A local-first Agent + digital-human assistant.** AIRIClaw fuses the agent /
skill / gateway runtime of [OpenClaw](https://github.com/openclaw/openclaw) with
the character and event protocol of [Project AIRI](https://github.com/moeru-ai/airi),
powered by **DeepSeek V4 Pro**.

It is **not** a bridge between two apps — it is a single, self-contained
TypeScript monolith that re-implements the pieces that matter and wires them
together into one runtime.

```
input:text ─▶ recall memory ─▶ build system prompt ─▶ DeepSeek agent loop ─▶ output:gen-ai:chat:*
                (AIRI memory)     (AIRI persona +          (OpenClaw           (AIRI protocol →
                                   OpenClaw skills)          agent-core)          avatar / voice)
```

## Features

- **DeepSeek V4 Pro** as the brain — OpenAI-compatible client with `non_think` /
  `think_high` / `think_max` thinking modes, 1M-token context, streaming.
- **Agent loop** (à la OpenClaw `agent-core`): streaming, tool-calling, iterates
  until the model stops requesting tools. Sequential or parallel tool execution.
- **Skills** in OpenClaw's `SKILL.md` format (YAML frontmatter with
  `metadata.openclaw`: emoji / requires / install / invocation policy). Skills
  become callable tools; invoking one feeds its `SKILL.md` body back to the
  model (progressive disclosure).
- **Character / persona** from an AIRI-style character card (personality,
  scenario, greetings, system prompt, avatar & speech modules).
- **Memory**: `MEMORY.md`, `DREAMS.md`, and dated daily notes, with keyword
  recall injected into the system prompt.
- **AIRI protocol events** (`input:text`, `output:gen-ai:chat:*`, `output:emotion`,
  `output:lipsync`, `output:speech`, `context:update`, `spark:*`) over a typed
  event bus — the seam where a digital-human frontend plugs in.
- **Gateway server** speaking OpenClaw's frame protocol **v4** (`req`/`res`/`event`)
  on port `18789`, with every protocol event fanned out to connected clients.
- **Voice / lip-sync interfaces** (`TTSProvider`, `STTProvider`, `LipSyncDriver`)
  with safe headless defaults, so the avatar layer has a contract to render
  against without shipping a full Vue/Electron frontend.

> 📖 **完整使用文档见 [docs/USAGE.md](./docs/USAGE.md)** — 安装、配置、CLI 命令、技能编写、角色卡、记忆、Library API、Gateway 接入、常见问题。

## Install & build

```bash
git clone https://github.com/JacksonTai2007/AIRIClaw.git
cd AIRIClaw
pnpm install
pnpm build      # tsup → dist/
pnpm test       # vitest (78 tests)
export DEEPSEEK_API_KEY=sk-...
node dist/cli.js chat "你好"
```

Requires Node ≥ 22.

## Usage

```bash
# One-shot or interactive chat
export DEEPSEEK_API_KEY=sk-...
airiclaw chat "what's on my plate today?"
airiclaw chat                      # interactive REPL

# Skills
AIRICLAW_SKILLS_DIR=examples/skills airiclaw skills list
airiclaw skills search weather

# Gateway server (protocol v4)
airiclaw serve --port 18789

# Config & status
airiclaw config init               # writes .airiclaw/config.json
airiclaw status
```

### Configuration

`.airiclaw/config.json` (created by `airiclaw config init`) overlaid with env vars:

| Env | Purpose |
| --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek API key (required for LLM calls) |
| `AIRICLAW_MODEL` | Model id (default `deepseek-v4-pro`) |
| `AIRICLAW_BASE_URL` | API base URL (default `https://api.deepseek.com`) |
| `AIRICLAW_THINKING_MODE` | `non_think` \| `think_high` \| `think_max` |
| `AIRICLAW_GATEWAY_PORT` | Gateway port (default `18789`) |
| `AIRICLAW_SKILLS_DIR` | Skills directory (recursively scanned for `SKILL.md`) |
| `AIRICLAW_MEMORY_DIR` | Memory directory (`MEMORY.md`, `DREAMS.md`, `daily/`) |

## Library usage

```ts
import { Assistant, loadConfig } from 'airiclaw'

const config = await loadConfig()
const assistant = new Assistant({ config })
await assistant.loadSkills()

assistant.events.on('output:gen-ai:chat:delta', ({ delta }) => process.stdout.write(delta))
assistant.events.on('output:lipsync', ({ mouthOpen }) => avatar.setMouth(mouthOpen))

const { text } = await assistant.chat('hello!')
```

## Architecture

A single package under `src/`, organized by concern:

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
| `src/runtime` | the fusion | `Assistant` — ties everything into one turn |
| `src/config` | — | Config schema + loader |
| `src/cli.ts` | — | `chat` / `skills` / `serve` / `config` / `status` |

Examples live under `examples/` (a sample skill and character card).

## Status

Headless core: complete, builds, and is covered by 78 tests. The digital-human
frontend (Live2D/VRM rendering, real TTS/STT) is intentionally left as an
interface — connect any renderer to the `output:*` events.

## License

MIT
