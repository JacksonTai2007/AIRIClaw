/**
 * Agent runtime contracts — a streaming, event-driven loop that calls the LLM,
 * executes tool calls, and iterates until the model stops asking for tools.
 *
 * Event names follow OpenClaw 2026.6.2 `agent-core` (`agent_start/end`,
 * `turn_start/end`, `message_start/update/end`, `tool_execution_start/end`).
 */

import type { ChatMessage, TokenUsage, ToolCall, ToolDefinition } from '../llm/types.js'

export type { ToolCall } from '../llm/types.js'

/** A message in the agent's working transcript. */
export interface AgentMessage extends ChatMessage {
  /** Stable id for tracing / event correlation. */
  id?: string
  /** Wall-clock creation time (ms epoch). */
  createdAt?: number
  /** Free-form metadata (source channel, skill name, ...). */
  metadata?: Record<string, unknown>
}

/** Result of executing one tool call. */
export interface ToolResult {
  toolCallId: string
  name: string
  /** Stringified result fed back to the model. */
  content: string
  isError?: boolean
}

/** Executes a requested tool call. */
export type ToolExecutor = (call: ToolCall, signal?: AbortSignal) => Promise<ToolResult>

export type ToolExecutionMode = 'sequential' | 'parallel'

/** Everything the loop needs for one run. */
export interface AgentContext {
  systemPrompt: string
  messages: AgentMessage[]
  tools: ToolDefinition[]
}

export interface AgentLoopConfig {
  /** Max LLM round-trips before forcibly stopping (default 12). */
  maxTurns?: number
  toolExecutionMode?: ToolExecutionMode
  /** Required whenever tools are provided. */
  executeTool?: ToolExecutor
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

/** Streaming lifecycle events emitted by the loop (OpenClaw-aligned names). */
export type AgentEvent =
  | { type: 'agent_start' }
  | { type: 'turn_start'; turn: number }
  | { type: 'message_start'; turn: number }
  | { type: 'message_update'; delta: string; channel: 'text' | 'reasoning' }
  | { type: 'message_end'; message: AgentMessage }
  | { type: 'tool_execution_start'; call: ToolCall }
  | { type: 'tool_execution_end'; result: ToolResult }
  | { type: 'turn_end'; turn: number }
  | { type: 'agent_end'; messages: AgentMessage[]; usage: TokenUsage }
  | { type: 'error'; error: Error }

export type AgentEventSink = (event: AgentEvent) => void
