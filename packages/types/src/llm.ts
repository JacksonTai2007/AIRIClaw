export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  tool_choice?: 'auto' | 'none' | 'required'
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export interface ChatCompletionResponse {
  id: string
  model: string
  choices: Array<{
    index: number
    message: ChatMessage
    finish_reason: 'stop' | 'tool_calls' | 'length'
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export const DEEPSEEK_DEFAULTS = {
  BASE_URL: 'https://api.deepseek.com',
  MODEL_PRO: 'deepseek-v4-pro',
  MODEL_FLASH: 'deepseek-v4-flash',
  MAX_CONTEXT: 1_000_000,
  MAX_OUTPUT: 384_000,
} as const
