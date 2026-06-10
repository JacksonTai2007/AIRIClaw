/**
 * The agent loop — streams LLM turns, executes requested tool calls, and
 * iterates until the model stops asking for tools (or maxTurns is hit).
 */

import type { ChatRequest, LLMProvider, TokenUsage } from '../llm/types.js'
import type {
  AgentContext,
  AgentEventSink,
  AgentLoopConfig,
  AgentMessage,
} from './types.js'
import { runToolCalls } from './tools.js'

const DEFAULT_MAX_TURNS = 12

export async function agentLoop(
  provider: LLMProvider,
  context: AgentContext,
  config: AgentLoopConfig,
  sink: AgentEventSink,
): Promise<AgentMessage[]> {
  const working: AgentMessage[] = [...context.messages]
  const usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS
  const hasTools = context.tools.length > 0

  try {
    sink({ type: 'agent_start' })

    for (let turn = 1; turn <= maxTurns; turn++) {
      sink({ type: 'turn_start', turn })
      sink({ type: 'message_start', turn })

      const request: ChatRequest = {
        messages: [
          { role: 'system', content: context.systemPrompt },
          ...working,
        ],
        ...(hasTools ? { tools: context.tools, toolChoice: 'auto' as const } : {}),
        ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
        ...(config.maxTokens !== undefined ? { maxTokens: config.maxTokens } : {}),
        ...(config.signal ? { signal: config.signal } : {}),
      }

      const response = await provider.stream(request, (ev) => {
        if (ev.type === 'text-delta') {
          sink({ type: 'message_update', delta: ev.text, channel: 'text' })
        } else if (ev.type === 'reasoning-delta') {
          sink({ type: 'message_update', delta: ev.text, channel: 'reasoning' })
        } else if (ev.type === 'error') {
          sink({ type: 'error', error: ev.error })
        }
        // 'tool-call' stream events are intentionally not forwarded — tool
        // calls are reported via tool_execution_start below.
      })

      const assistantMessage: AgentMessage = { ...response.message, createdAt: Date.now() }
      working.push(assistantMessage)
      sink({ type: 'message_end', message: assistantMessage })

      usage.promptTokens += response.usage.promptTokens
      usage.completionTokens += response.usage.completionTokens
      usage.totalTokens += response.usage.totalTokens

      const toolCalls = assistantMessage.tool_calls
      if (toolCalls?.length && config.executeTool) {
        for (const call of toolCalls) {
          sink({ type: 'tool_execution_start', call })
        }

        const results = await runToolCalls(
          toolCalls,
          config.executeTool,
          config.toolExecutionMode ?? 'parallel',
          config.signal,
        )

        for (const result of results) {
          sink({ type: 'tool_execution_end', result })
          working.push({
            role: 'tool',
            content: result.content,
            tool_call_id: result.toolCallId,
            name: result.name,
            createdAt: Date.now(),
          })
        }

        sink({ type: 'turn_end', turn })
        continue
      }

      sink({ type: 'turn_end', turn })
      break
    }

    sink({ type: 'agent_end', messages: working, usage })
    return working
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    sink({ type: 'error', error })
    throw err
  }
}
