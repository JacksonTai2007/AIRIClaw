/**
 * The Assistant runtime — where OpenClaw's agent/skill core meets AIRI's
 * character & event protocol, powered by DeepSeek V4 Pro.
 *
 * A turn flows like this:
 *   input:text
 *     -> recall long-term memory (keyword search)         [AIRI memory]
 *     -> build system prompt from character card + skills  [AIRI persona / OpenClaw skills]
 *     -> run the agent loop against DeepSeek               [OpenClaw agent-core]
 *         - skill tools, when called, return their SKILL.md body (progressive disclosure)
 *     -> stream output:gen-ai:chat:* protocol events       [AIRI protocol]
 *     -> persist the exchange to memory
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
import type { LLMProvider } from '../llm/types.js'
import { agentLoop } from '../agent/loop.js'
import type {
  AgentContext,
  AgentEvent,
  AgentMessage,
  ToolResult,
} from '../agent/types.js'
import type { ToolCall } from '../llm/types.js'
import { EventBus } from '../events/bus.js'

export interface AssistantOptions {
  config: AppConfig
  character?: CharacterCard
  /** Inject a provider (tests). Defaults to a DeepSeekProvider from config.llm. */
  provider?: LLMProvider
  /** Inject a skill registry (tests). Defaults to discovery from config.skillsDir. */
  registry?: SkillRegistry
  /** Inject a memory store (tests). Defaults to config.memoryDir. */
  memory?: MemoryStore
  /** Shared event bus. Defaults to a fresh one (exposed as `.events`). */
  bus?: EventBus
}

export interface ChatResult {
  /** Final assistant text. */
  text: string
  /** Full transcript produced this turn (assistant + tool messages appended). */
  messages: AgentMessage[]
}

/** Mirrors a sanitized tool name back to the skill it represents. */
function buildSkillToolIndex(skills: Skill[]): Map<string, Skill> {
  const index = new Map<string, Skill>()
  const tools = skillsToTools(skills)
  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i]
    const skill = skills[i]
    if (tool && skill) index.set(tool.function.name, skill)
  }
  return index
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
      // No skills dir yet — that's fine, the assistant still runs.
    }
    return this.registry.size
  }

  /**
   * Run one conversational turn. Streams protocol events on `this.events` and
   * returns the final assistant text + this turn's transcript.
   */
  async chat(input: string, sessionId?: string): Promise<ChatResult> {
    this.events.emit('input:text', { text: input, sessionId, source: 'api' })

    const skills = this.registry.search('') // model-invocable skills only
    const skillIndex = buildSkillToolIndex(skills)
    const tools = skillsToTools(skills)

    const memoryHits = await this.recall(input)
    const systemPrompt = buildSystemPrompt(this.character, {
      skills: formatSkillsForPrompt(skills),
      memory: memoryHits,
    })

    const userMessage: AgentMessage = {
      role: 'user',
      content: input,
      createdAt: Date.now(),
    }
    this.history.push(userMessage)

    const context: AgentContext = {
      systemPrompt,
      messages: [...this.history],
      tools,
    }

    const sink = (event: AgentEvent) => this.forwardAgentEvent(event, sessionId)

    const produced = await agentLoop(
      this.provider,
      context,
      {
        maxTurns: this.config.maxTurns,
        temperature: this.config.llm.temperature,
        maxTokens: this.config.llm.maxTokens,
        executeTool: (call) => this.executeSkillTool(call, skillIndex),
      },
      sink,
    )

    // Append everything after the user message to history.
    this.history.push(...produced.slice(context.messages.length))

    const finalText = lastAssistantText(produced)
    await this.persist(input, finalText)
    return { text: finalText, messages: produced }
  }

  /** Recall relevant long-term memory as a prompt-ready string. */
  private async recall(query: string): Promise<string> {
    const results = await this.memory.search(query, 5).catch(() => [])
    if (results.length === 0) return ''
    return results.map((r) => `- ${r.chunk.text.trim()}`).join('\n')
  }

  /** A skill tool, when invoked, returns its SKILL.md body for the model to follow. */
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
    return {
      toolCallId: call.id,
      name: call.function.name,
      content: skill.instructions,
    }
  }

  /** Translate agent-loop events into AIRI protocol events on the bus. */
  private forwardAgentEvent(event: AgentEvent, sessionId?: string): void {
    switch (event.type) {
      case 'text_delta':
        this.events.emit('output:gen-ai:chat:delta', { delta: event.text, sessionId })
        break
      case 'tool_call':
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

  /** Persist the exchange to long-term memory (best-effort). */
  private async persist(input: string, output: string): Promise<void> {
    if (!output) return
    await this.memory
      .appendDailyNote(`**User:** ${input}\n\n**${this.character.name}:** ${output}`)
      .catch(() => {})
  }
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
