import type { BridgeModule, BridgeEventBus } from '@airiclaw/core'
import { BRIDGE_EVENTS, type LLMConfig, type ChatMessage, type ToolDefinition } from '@airiclaw/types'
import { DeepSeekClient, type CompletionOptions } from './client.js'

export interface LLMBridgeOptions {
  config: LLMConfig
  events?: BridgeEventBus
}

export class LLMBridge implements BridgeModule {
  readonly name = 'llm-bridge'
  private client: DeepSeekClient | null = null

  constructor(private readonly options: LLMBridgeOptions) {}

  async start(): Promise<void> {
    this.client = new DeepSeekClient(this.options.config)
  }

  async stop(): Promise<void> {
    this.client = null
  }

  async chat(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<string> {
    if (!this.client) throw new Error('LLMBridge not started')
    const opts: CompletionOptions = { messages }
    if (tools?.length) {
      opts.tools = tools
      opts.toolChoice = 'auto'
    }
    this.options.events?.emit(BRIDGE_EVENTS.LLM_REQUEST, {
      model: this.client.getModel(),
      messageCount: messages.length,
    })
    try {
      const response = await this.client.chat(opts)
      const reply = response.choices[0]?.message.content ?? ''
      this.options.events?.emit(BRIDGE_EVENTS.LLM_RESPONSE, {
        model: response.model,
        usage: response.usage,
        hasToolCalls: response.choices[0]?.message.tool_calls != null,
      })
      return reply
    }
    catch (err) {
      this.options.events?.emit(BRIDGE_EVENTS.LLM_ERROR, {
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  getClient(): DeepSeekClient | null {
    return this.client
  }
}
