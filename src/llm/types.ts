/**
 * LLM contracts. Provider-agnostic chat/tool types plus the streaming event
 * shape. Modelled on OpenClaw's `llm-core` types and AIRI's xsAI StreamEvent,
 * unified into one OpenAI-compatible surface that DeepSeek V4 Pro plugs into.
 */

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    /** Raw JSON string of arguments, as returned by the model. */
    arguments: string
  }
}

export interface ChatMessage {
  role: MessageRole
  content: string
  /** Present on `tool` messages: the id of the call this result answers. */
  tool_call_id?: string
  /** Optional speaker name (OpenAI `name` field). */
  name?: string
  /** Present on `assistant` messages that request tool calls. */
  tool_calls?: ToolCall[]
  /** Reasoning trace surfaced by thinking models (DeepSeek `reasoning_content`). */
  reasoning?: string
}

/** A JSON-schema-shaped tool definition the model may call. */
export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** DeepSeek V4 Pro thinking modes (April 2026 API). */
export type ThinkingMode = 'non_think' | 'think_high' | 'think_max'

export interface LLMConfig {
  provider: string
  model: string
  apiKey?: string
  baseURL?: string
  thinkingMode?: ThinkingMode
  temperature?: number
  maxTokens?: number
}

export interface ChatRequest {
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  toolChoice?: 'auto' | 'none' | 'required'
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type FinishReason = 'stop' | 'tool_calls' | 'length' | 'error'

export interface ChatResponse {
  id: string
  model: string
  message: ChatMessage
  finishReason: FinishReason
  usage: TokenUsage
}

/**
 * Streaming delta events. Mirrors AIRI's xsAI StreamEvent so the digital-human
 * layer can consume token/reasoning deltas for real-time speech & captions.
 */
export type StreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'tool-call'; toolCall: ToolCall }
  | { type: 'finish'; finishReason: FinishReason; usage?: TokenUsage }
  | { type: 'error'; error: Error }

/** The provider contract. A provider streams events and resolves a final response. */
export interface LLMProvider {
  readonly id: string
  chat(request: ChatRequest): Promise<ChatResponse>
  stream(request: ChatRequest, onEvent: (event: StreamEvent) => void): Promise<ChatResponse>
}

/** DeepSeek V4 Pro defaults (api.deepseek.com, OpenAI-compatible). */
export const DEEPSEEK_DEFAULTS = {
  BASE_URL: 'https://api.deepseek.com',
  MODEL_PRO: 'deepseek-v4-pro',
  MODEL_FLASH: 'deepseek-v4-flash',
  MAX_CONTEXT: 1_000_000,
  MAX_OUTPUT: 384_000,
  THINKING_MODE: 'think_high' as ThinkingMode,
} as const
