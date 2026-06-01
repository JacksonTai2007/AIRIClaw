/**
 * Core streaming agent loop. Calls the LLM, forwards token/reasoning deltas,
 * executes any requested tool calls, and iterates until the model stops asking
 * for tools or maxTurns is reached.
 */

import type {
  ChatRequest,
  LLMProvider,
  TokenUsage,
} from '../llm/types.js'
import { runToolCalls } from './tools.js'
import type {
  AgentContext,
  AgentEventSink,
  AgentLoopConfig,
  AgentMessage,
} from './types.js'

const DEFAULT_MAX_TURNS = 12

export async function agentLoop(
  provider: LLMProvider,
  context: AgentContext,
  config: AgentLoopConfig,
  sink: AgentEventSink,
): Promise<AgentMessage[]> {
  const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS
  const executionMode = config.toolExecutionMode ?? 'parallel'
  const messages: AgentMessage[] = [...context.messages]
  const usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  try {
    sink({ type: 'agent_start' })

    for (let turn = 1; turn <= maxTurns; turn++) {
      sink({ type: 'turn_start', turn })

      const request: ChatRequest = {
        messages: [
          { role: 'system', content: context.systemPrompt },
          ...messages,
        ],
        ...(context.tools.length > 0
          ? { tools: context.tools, toolChoice: 'auto' as const }
          : {}),
        ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
        ...(config.maxTokens !== undefined ? { maxTokens: config.maxTokens } : {}),
        ...(config.signal ? { signal: config.signal } : {}),
      }

      const response = await provider.stream(request, (ev) => {
        switch (ev.type) {
          case 'text-delta':
            sink({ type: 'text_delta', text: ev.text })
            break
          case 'reasoning-delta':
            sink({ type: 'reasoning_delta', text: ev.text })
            break
          case 'tool-call':
            sink({ type: 'tool_call', call: ev.toolCall })
            break
          case 'error':
            sink({ type: 'error', error: ev.error })
            break
          default:
            break
        }
      })

      // Accumulate usage across turns.
      usage.promptTokens += response.usage.promptTokens
      usage.completionTokens += response.usage.completionTokens
      usage.totalTokens += response.usage.totalTokens

      const assistantMessage: AgentMessage = { ...response.message }
      messages.push(assistantMessage)
      sink({ type: 'message_end', message: assistantMessage })

      const toolCalls = assistantMessage.tool_calls
      if (toolCalls && toolCalls.length > 0 && config.executeTool) {
        const results = await runToolCalls(
          toolCalls,
          config.executeTool,
          executionMode,
          config.signal,
        )

        for (const result of results) {
          const toolMessage: AgentMessage = {
            role: 'tool',
            content: result.content,
            tool_call_id: result.toolCallId,
            name: result.name,
          }
          messages.push(toolMessage)
          sink({ type: 'tool_result', result })
        }

        sink({ type: 'turn_end', turn })
        continue
      }

      sink({ type: 'turn_end', turn })
      break
    }

    sink({ type: 'agent_end', messages, usage })
    return messages
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    sink({ type: 'error', error: err })
    throw err
  }
}
