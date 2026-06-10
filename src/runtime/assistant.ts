/**
 * The Assistant runtime — where OpenClaw's agent/skill core meets AIRI's
 * character & event protocol, powered by DeepSeek V4 Pro.
 *
 * One turn:
 *   input:text
 *     -> recall long-term memory (keyword search)          [memory]
 *     -> build system prompt: persona + skills + memory     [character/skills]
 *        (`always` skills get their full instructions inlined)
 *     -> run the streaming agent loop against DeepSeek      [agent]
 *        (skill tools return their SKILL.md body — progressive disclosure)
 *     -> emit output:gen-ai:chat:* protocol events          [events]
 *     -> persist the exchange to a daily note               [memory]
 */

import type { AppConfig } from '../config/schema.js'
import type { CharacterCard } from '../character/card.js'
import { DEFAULT_CHARACTER } from '../character/card.js'
import { buildSystemPrompt } from '../character/prompt.js'
import { MemoryStore } from '../memory/store.js'
import { SkillRegistry } from '../skills/registry.js'
import { loadSkillRegistry } from '../skills/discovery.js'
import { formatSkillsForPrompt } from '../skills/prompt.js'
import { skillsToTools } from '../skills/tool-adapter.js'
import type { Skill } from '../skills/types.js'
import { DeepSeekProvider } from '../llm/deepseek.js'
import type { LLMProvider, ToolCall } from '../llm/types.js'
import { agentLoop } from '../agent/loop.js'
import type { AgentContext, AgentEvent, AgentMessage, ToolResult } from '../agent/types.js'
import { EventBus } from '../events/bus.js'

export interface AssistantOptions {
  config: AppConfig
  character?: CharacterCard
  /** Inject a provider (tests). Defaults to DeepSeekProvider from config.llm. */
  provider?: LLMProvider
  /** Inject a registry (tests). Defaults to discovery from config.skillsDir. */
  registry?: SkillRegistry
  /** Inject a memory store (tests). Defaults to config.memoryDir. */
  memory?: MemoryStore
  /** Shared event bus. Defaults to a fresh one (exposed as `.events`). */
  bus?: EventBus
}

export interface ChatResult {
  /** Final assistant text. */
  text: string
  /** Full transcript produced this turn. */
  messages: AgentMessage[]
}

export class Assistant {
  readonly events: EventBus
  readonly character: CharacterCard
  private readonly config: AppConfig
  private readonly provider: LLMProvider
  private readonly memory: MemoryStore
  private registry: SkillRegistry
  private readonly history: AgentMessage[] = []

  constructor(options: AssistantOptions) {
    this.config = options.config
    this.character = options.character ?? DEFAULT_CHARACTER
    this.events = options.bus ?? new EventBus()
    this.provider = options.provider ?? new DeepSeekProvider(options.config.llm)
    this.registry = options.registry ?? new SkillRegistry()
    this.memory =
      options.memory ?? new MemoryStore(MemoryStore.defaultPaths(options.config.memoryDir))
  }

  /** Discover skills from disk (call once at startup). Safe to skip in tests. */
  async loadSkills(): Promise<number> {
    try {
      this.registry = await loadSkillRegistry(this.config.skillsDir)
    } catch {
      // No skills directory yet — the assistant still runs.
    }
    return this.registry.size
  }

  /**
   * Run one conversational turn. Streams protocol events on `this.events` and
   * resolves with the final assistant text plus this turn's transcript.
   */
  async chat(input: string, sessionId?: string): Promise<ChatResult> {
    this.events.emit('input:text', { text: input, sessionId, source: 'api' })

    // Model-invocable skills become tools; `always` skills are inlined fully.
    const skills = this.registry.search('')
    const tools = skillsToTools(skills)
    const skillIndex = buildToolIndex(skills, tools.map((t) => t.function.name))
    const alwaysInstructions = this.registry
      .list({ alwaysOnly: true })
      .map((s) => s.instructions)

    const memory = await this.recall(input)
    const systemPrompt = buildSystemPrompt(this.character, {
      skills: formatSkillsForPrompt(skills),
      memory,
      contexts: alwaysInstructions,
    })

    this.history.push({ role: 'user', content: input, createdAt: Date.now() })

    const context: AgentContext = {
      systemPrompt,
      messages: [...this.history],
      tools,
    }

    const produced = await agentLoop(
      this.provider,
      context,
      {
        maxTurns: this.config.maxTurns,
        temperature: this.config.llm.temperature,
        maxTokens: this.config.llm.maxTokens,
        executeTool: (call) => this.executeSkillTool(call, skillIndex),
      },
      (event) => this.forwardAgentEvent(event, sessionId),
    )

    this.history.push(...produced.slice(context.messages.length))

    const text = lastAssistantText(produced)
    await this.persist(input, text)
    return { text, messages: produced }
  }

  /** Recall relevant long-term memory as a prompt-ready bullet list. */
  private async recall(query: string): Promise<string> {
    const results = await this.memory.search(query, 5).catch(() => [])
    if (results.length === 0) return ''
    return results.map((r) => `- ${r.chunk.text.trim()}`).join('\n')
  }

  /** A skill tool returns its SKILL.md body for the model to follow. */
  private async executeSkillTool(
    call: ToolCall,
    index: Map<string, Skill>,
  ): Promise<ToolResult> {
    const skill = index.get(call.function.name)
    if (!skill) {
      return {
        toolCallId: call.id,
        name: call.function.name,
        content: `Unknown skill tool: ${call.function.name}`,
        isError: true,
      }
    }
    return { toolCallId: call.id, name: call.function.name, content: skill.instructions }
  }

  /** Translate agent-loop events into AIRI protocol events on the bus. */
  private forwardAgentEvent(event: AgentEvent, sessionId?: string): void {
    switch (event.type) {
      case 'message_update':
        if (event.channel === 'text') {
          this.events.emit('output:gen-ai:chat:delta', { delta: event.delta, sessionId })
        }
        break
      case 'tool_execution_start':
        this.events.emit('output:gen-ai:chat:tool-call', { call: event.call, sessionId })
        break
      case 'message_end':
        if (event.message.role === 'assistant') {
          this.events.emit('output:gen-ai:chat:message', { message: event.message, sessionId })
        }
        break
      case 'agent_end': {
        const final = lastAssistantMessage(event.messages)
        if (final) {
          this.events.emit('output:gen-ai:chat:complete', {
            message: final,
            usage: event.usage,
            sessionId,
          })
        }
        break
      }
      default:
        break
    }
  }

  /** Persist the exchange to today's daily note (best-effort). */
  private async persist(input: string, output: string): Promise<void> {
    if (!output) return
    await this.memory
      .appendDailyNote(`**User:** ${input}\n\n**${this.character.name}:** ${output}`)
      .catch(() => {})
  }
}

/** Map sanitized tool names back to the skills they wrap. */
function buildToolIndex(skills: Skill[], toolNames: string[]): Map<string, Skill> {
  const index = new Map<string, Skill>()
  for (let i = 0; i < toolNames.length; i++) {
    const name = toolNames[i]
    const skill = skills[i]
    if (name && skill) index.set(name, skill)
  }
  return index
}

function lastAssistantMessage(messages: AgentMessage[]): AgentMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m && m.role === 'assistant') return m
  }
  return undefined
}

function lastAssistantText(messages: AgentMessage[]): string {
  return lastAssistantMessage(messages)?.content ?? ''
}
