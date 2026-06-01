/**
 * Agent runtime contracts. Modelled on OpenClaw's `agent-core`: a streaming,
 * event-driven loop that calls the LLM, executes tool calls, and iterates until
 * the model stops requesting tools.
 */

import type { ChatMessage, ToolCall, ToolDefinition, TokenUsage } from '../llm/types.js'

/** A message in the agent's working transcript. Extends the LLM chat message. */
export interface AgentMessage extends ChatMessage {
  /** Stable id for tracing / event correlation. */
  id?: string
  /** Wall-clock creation time (ms epoch). */
  createdAt?: number
  /** Free-form metadata (source channel, skill id, etc.). */
  metadata?: Record<string, unknown>
}

/** The result of executing a single tool call. */
export interface ToolResult {
  toolCallId: string
  name: string
  /** Stringified result fed back to the model. */
  content: string
  isError?: boolean
}

/** Executes a tool call and returns its result content. */
export type ToolExecutor = (call: ToolCall, signal?: AbortSignal) => Promise<ToolResult>

export type ToolExecutionMode = 'sequential' | 'parallel'

/** Everything the loop needs for one run. */
export interface AgentContext {
  systemPrompt: string
  messages: AgentMessage[]
  tools: ToolDefinition[]
}

export interface AgentLoopConfig {
  /** Max LLM round-trips before forcibly stopping (guards runaway tool loops). */
  maxTurns?: number
  toolExecutionMode?: ToolExecutionMode
  /** Executes a requested tool call. Required if any tools are provided. */
  executeTool?: ToolExecutor
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

/** Streaming lifecycle events emitted by the agent loop. */
export type AgentEvent =
  | { type: 'agent_start' }
  | { type: 'turn_start'; turn: number }
  | { type: 'text_delta'; text: string }
  | { type: 'reasoning_delta'; text: string }
  | { type: 'message_end'; message: AgentMessage }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'tool_result'; result: ToolResult }
  | { type: 'turn_end'; turn: number }
  | { type: 'agent_end'; messages: AgentMessage[]; usage: TokenUsage }
  | { type: 'error'; error: Error }

export type AgentEventSink = (event: AgentEvent) => void
