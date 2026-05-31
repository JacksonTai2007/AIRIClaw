import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import {
  DEEPSEEK_DEFAULTS,
  type LLMConfig,
  type ChatMessage,
  type ChatCompletionResponse,
  type ToolDefinition,
} from '@airiclaw/types'

export interface CompletionOptions {
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  toolChoice?: 'auto' | 'none' | 'required'
  temperature?: number
  maxTokens?: number
}

export class DeepSeekClient {
  private readonly client: OpenAI
  private readonly model: string
  private readonly thinkingMode: string

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.DEEPSEEK_API_KEY,
      baseURL: config.baseURL ?? DEEPSEEK_DEFAULTS.BASE_URL,
    })
    this.model = config.model ?? DEEPSEEK_DEFAULTS.MODEL_PRO
    this.thinkingMode = config.thinkingMode ?? 'think_high'
  }

  async chat(options: CompletionOptions): Promise<ChatCompletionResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: options.messages as unknown as ChatCompletionMessageParam[],
      ...(options.tools ? { tools: options.tools } : {}),
      ...(options.toolChoice ? { tool_choice: options.toolChoice } : {}),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    })

    return {
      id: response.id,
      model: response.model,
      choices: response.choices.map(c => ({
        index: c.index,
        message: {
          role: c.message.role,
          content: c.message.content ?? '',
          tool_calls: c.message.tool_calls?.map(tc => ({
            id: tc.id,
            type: tc.type as 'function',
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        },
        finish_reason: c.finish_reason as 'stop' | 'tool_calls' | 'length',
      })),
      usage: {
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
        total_tokens: response.usage?.total_tokens ?? 0,
      },
    }
  }

  getModel(): string {
    return this.model
  }

  getThinkingMode(): string {
    return this.thinkingMode
  }
}
