/**
 * DeepSeek V4 Pro LLM provider. OpenAI-compatible surface (api.deepseek.com)
 * with the V4 Pro `thinking_mode` body extension, mapped onto our provider
 * contract from ./types.ts.
 */

import OpenAI from 'openai'
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'

import {
  DEEPSEEK_DEFAULTS,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type FinishReason,
  type LLMConfig,
  type LLMProvider,
  type StreamEvent,
  type ThinkingMode,
  type TokenUsage,
  type ToolCall,
} from './types.js'

/** Map an OpenAI finish_reason to our FinishReason. */
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

/** Accumulator for tool calls streamed in index-keyed fragments. */
interface ToolCallAccumulator {
  id: string
  name: string
  arguments: string
}

export class DeepSeekProvider implements LLMProvider {
  readonly id = 'deepseek'

  private readonly client: OpenAI
  private readonly config: LLMConfig
  private readonly model: string
  private readonly thinkingMode: ThinkingMode

  constructor(config: LLMConfig) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.DEEPSEEK_API_KEY,
      baseURL: config.baseURL ?? DEEPSEEK_DEFAULTS.BASE_URL,
    })
    this.model = config.model || DEEPSEEK_DEFAULTS.MODEL_PRO
    this.thinkingMode = config.thinkingMode ?? DEEPSEEK_DEFAULTS.THINKING_MODE
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      // `extra_body` is a DeepSeek V4 Pro extension not present in OpenAI's
      // param types, so build the body untyped and cast at the call boundary.
      const body: ChatCompletionCreateParamsNonStreaming & { extra_body?: Record<string, unknown> } = {
        model: this.model,
        // Cast to satisfy OpenAI's discriminated-union message type (known issue).
        messages: request.messages as unknown as ChatCompletionMessageParam[],
        ...(request.tools ? { tools: request.tools } : {}),
        ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}),
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
        // DeepSeek V4 Pro accepts thinking_mode via the request body.
        extra_body: { thinking_mode: this.thinkingMode },
      }
      const response = await this.client.chat.completions.create(body, { signal: request.signal })

      const choice = response.choices[0]
      const msg = choice?.message
      const rawToolCalls = msg?.tool_calls
      const toolCalls: ToolCall[] | undefined =
        rawToolCalls && rawToolCalls.length > 0
          ? rawToolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            }))
          : undefined

      // DeepSeek surfaces the chain-of-thought under reasoning_content.
      const reasoning = (msg as { reasoning_content?: string } | undefined)?.reasoning_content

      const message: ChatMessage = {
        role: 'assistant',
        content: msg?.content ?? '',
        ...(toolCalls ? { tool_calls: toolCalls } : {}),
        ...(reasoning ? { reasoning } : {}),
      }

      return {
        id: response.id,
        model: response.model,
        message,
        finishReason: mapFinishReason(choice?.finish_reason),
        usage: mapUsage(response.usage),
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  async stream(request: ChatRequest, onEvent: (event: StreamEvent) => void): Promise<ChatResponse> {
    let content = ''
    let reasoning = ''
    let id = ''
    let model = this.model
    let finishReason: FinishReason = 'stop'
    let usage: TokenUsage | undefined
    // Index-keyed accumulator: tool-call fragments arrive across chunks.
    const toolAcc = new Map<number, ToolCallAccumulator>()
    const emitted = new Set<number>()

    const finalize = (): ToolCall[] => {
      const ordered = [...toolAcc.entries()].sort((a, b) => a[0] - b[0])
      return ordered.map(([, acc]) => ({
        id: acc.id,
        type: 'function' as const,
        function: { name: acc.name, arguments: acc.arguments },
      }))
    }

    try {
      const body: ChatCompletionCreateParamsStreaming & { extra_body?: Record<string, unknown> } = {
        model: this.model,
        messages: request.messages as unknown as ChatCompletionMessageParam[],
        ...(request.tools ? { tools: request.tools } : {}),
        ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}),
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
        stream: true,
        stream_options: { include_usage: true },
        // DeepSeek V4 Pro accepts thinking_mode via the request body.
        extra_body: { thinking_mode: this.thinkingMode },
      }
      const streamResp = await this.client.chat.completions.create(body, { signal: request.signal })

      for await (const chunk of streamResp) {
        if (chunk.id) id = chunk.id
        if (chunk.model) model = chunk.model
        if (chunk.usage) usage = mapUsage(chunk.usage)

        const choice = chunk.choices[0]
        if (!choice) continue
        const delta = choice.delta as {
          content?: string | null
          reasoning_content?: string | null
          tool_calls?: Array<{
            index: number
            id?: string
            function?: { name?: string; arguments?: string }
          }>
        }

        if (delta.content) {
          content += delta.content
          onEvent({ type: 'text-delta', text: delta.content })
        }

        if (delta.reasoning_content) {
          reasoning += delta.reasoning_content
          onEvent({ type: 'reasoning-delta', text: delta.reasoning_content })
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const acc = toolAcc.get(tc.index) ?? { id: '', name: '', arguments: '' }
            if (tc.id) acc.id = tc.id
            if (tc.function?.name) acc.name = tc.function.name
            if (tc.function?.arguments) acc.arguments += tc.function.arguments
            toolAcc.set(tc.index, acc)
          }
        }

        if (choice.finish_reason) {
          finishReason = mapFinishReason(choice.finish_reason)
        }
      }

      const toolCalls = finalize()
      // Emit any tool calls not yet surfaced (we emit all at completion/end).
      for (const [index, acc] of toolAcc.entries()) {
        if (emitted.has(index)) continue
        emitted.add(index)
        onEvent({
          type: 'tool-call',
          toolCall: {
            id: acc.id,
            type: 'function',
            function: { name: acc.name, arguments: acc.arguments },
          },
        })
      }

      onEvent({ type: 'finish', finishReason, ...(usage ? { usage } : {}) })

      const message: ChatMessage = {
        role: 'assistant',
        content,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        ...(reasoning ? { reasoning } : {}),
      }

      return {
        id,
        model,
        message,
        finishReason,
        usage: usage ?? mapUsage(undefined),
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      onEvent({ type: 'error', error: err })
      throw err
    }
  }
}
