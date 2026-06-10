/**
 * DeepSeek V4 Pro provider — OpenAI-compatible chat completions with the
 * DeepSeek `thinking_mode` extra-body param and `reasoning_content` deltas.
 */

import OpenAI from 'openai'
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import type {
  ChatRequest,
  ChatResponse,
  FinishReason,
  LLMConfig,
  LLMProvider,
  StreamEvent,
  ThinkingMode,
  TokenUsage,
  ToolCall,
} from './types.js'
import { DEEPSEEK_DEFAULTS } from './types.js'

function mapFinishReason(reason: string | null | undefined): FinishReason {
  switch (reason) {
    case 'tool_calls':
      return 'tool_calls'
    case 'length':
      return 'length'
    case 'stop':
      return 'stop'
    default:
      return 'stop'
  }
}

function mapUsage(usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null | undefined): TokenUsage {
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  }
}

export class DeepSeekProvider implements LLMProvider {
  readonly id = 'deepseek'

  private readonly client: OpenAI
  private readonly model: string
  private readonly thinkingMode: ThinkingMode
  private readonly config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.DEEPSEEK_API_KEY ?? 'unset',
      baseURL: config.baseURL ?? DEEPSEEK_DEFAULTS.BASE_URL,
    })
    this.model = config.model || DEEPSEEK_DEFAULTS.MODEL_PRO
    this.thinkingMode = config.thinkingMode ?? DEEPSEEK_DEFAULTS.THINKING_MODE
  }

  getModel(): string {
    return this.model
  }

  getThinkingMode(): ThinkingMode {
    return this.thinkingMode
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body: ChatCompletionCreateParamsNonStreaming & { extra_body?: Record<string, unknown> } = {
      model: this.model,
      messages: request.messages as unknown as ChatCompletionMessageParam[],
      ...(request.tools ? { tools: request.tools } : {}),
      ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}),
      temperature: request.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
      extra_body: { thinking_mode: this.thinkingMode },
    }

    const response = await this.client.chat.completions.create(body, { signal: request.signal })
    const c = response.choices[0]
    if (!c) {
      throw new Error('DeepSeek response contained no choices')
    }

    const reasoning = (c.message as any).reasoning_content
    return {
      id: response.id,
      model: response.model,
      message: {
        role: 'assistant',
        content: c.message.content ?? '',
        ...(c.message.tool_calls?.length
          ? {
              tool_calls: c.message.tool_calls.map((tc): ToolCall => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                },
              })),
            }
          : {}),
        ...(typeof reasoning === 'string' ? { reasoning } : {}),
      },
      finishReason: mapFinishReason(c.finish_reason),
      usage: mapUsage(response.usage),
    }
  }

  async stream(request: ChatRequest, onEvent: (event: StreamEvent) => void): Promise<ChatResponse> {
    const body: ChatCompletionCreateParamsStreaming & { extra_body?: Record<string, unknown> } = {
      model: this.model,
      messages: request.messages as unknown as ChatCompletionMessageParam[],
      ...(request.tools ? { tools: request.tools } : {}),
      ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}),
      temperature: request.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
      stream: true,
      stream_options: { include_usage: true },
      extra_body: { thinking_mode: this.thinkingMode },
    }

    try {
      const stream = await this.client.chat.completions.create(body, { signal: request.signal })

      let id = ''
      let model = this.model
      let content = ''
      let reasoning = ''
      let finishReason: FinishReason = 'stop'
      let sawFinish = false
      let usage: TokenUsage | undefined
      const toolAcc = new Map<number, { id: string; name: string; arguments: string }>()

      for await (const chunk of stream) {
        if (chunk.id) id = chunk.id
        if (chunk.model) model = chunk.model
        if (chunk.usage) usage = mapUsage(chunk.usage)

        const choice = chunk.choices[0]
        if (!choice) continue

        const delta = choice.delta
        if (delta?.content) {
          content += delta.content
          onEvent({ type: 'text-delta', text: delta.content })
        }
        const reasoningDelta = (delta as any)?.reasoning_content
        if (typeof reasoningDelta === 'string' && reasoningDelta.length > 0) {
          reasoning += reasoningDelta
          onEvent({ type: 'reasoning-delta', text: reasoningDelta })
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index
            let acc = toolAcc.get(index)
            if (!acc) {
              acc = { id: '', name: '', arguments: '' }
              toolAcc.set(index, acc)
            }
            if (tc.id) acc.id = tc.id
            if (tc.function?.name) acc.name += tc.function.name
            if (tc.function?.arguments) acc.arguments += tc.function.arguments
          }
        }
        if (choice.finish_reason) {
          finishReason = mapFinishReason(choice.finish_reason)
          sawFinish = true
        }
      }

      const toolCalls: ToolCall[] = [...toolAcc.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, acc]) => ({
          id: acc.id,
          type: 'function' as const,
          function: { name: acc.name, arguments: acc.arguments },
        }))

      for (const toolCall of toolCalls) {
        onEvent({ type: 'tool-call', toolCall })
      }

      if (!sawFinish && toolCalls.length > 0) {
        finishReason = 'tool_calls'
      }

      const finalUsage = usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      onEvent({ type: 'finish', finishReason, usage: finalUsage })

      return {
        id,
        model,
        message: {
          role: 'assistant',
          content,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
          ...(reasoning.length > 0 ? { reasoning } : {}),
        },
        finishReason,
        usage: finalUsage,
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      onEvent({ type: 'error', error })
      throw err
    }
  }
}
