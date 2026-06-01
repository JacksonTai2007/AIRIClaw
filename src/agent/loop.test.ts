import { describe, expect, it, vi } from 'vitest'

import type {
  ChatRequest,
  ChatResponse,
  LLMProvider,
  StreamEvent,
} from '../llm/types.js'
import { agentLoop } from './loop.js'
import type { AgentContext, AgentEvent, AgentLoopConfig, ToolResult } from './types.js'

/**
 * A fake provider that replays scripted responses turn by turn. It also fires
 * the matching stream events so we exercise the loop's event forwarding.
 */
function scriptedProvider(responses: ChatResponse[]): LLMProvider {
  let i = 0
  return {
    id: 'fake',
    async chat(): Promise<ChatResponse> {
      return responses[i++]!
    },
    async stream(_request: ChatRequest, onEvent: (event: StreamEvent) => void): Promise<ChatResponse> {
      const response = responses[i++]!
      if (response.message.content) {
        onEvent({ type: 'text-delta', text: response.message.content })
      }
      if (response.message.reasoning) {
        onEvent({ type: 'reasoning-delta', text: response.message.reasoning })
      }
      for (const tc of response.message.tool_calls ?? []) {
        onEvent({ type: 'tool-call', toolCall: tc })
      }
      onEvent({ type: 'finish', finishReason: response.finishReason, usage: response.usage })
      return response
    },
  }
}

describe('agentLoop', () => {
  it('executes tool calls then terminates on a plain stop response', async () => {
    const provider = scriptedProvider([
      {
        id: 'r1',
        model: 'deepseek-v4-pro',
        finishReason: 'tool_calls',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'get_time', arguments: '{}' } },
          ],
        },
      },
      {
        id: 'r2',
        model: 'deepseek-v4-pro',
        finishReason: 'stop',
        usage: { promptTokens: 20, completionTokens: 8, totalTokens: 28 },
        message: { role: 'assistant', content: 'It is noon.' },
      },
    ])

    const executeTool = vi.fn(async (call): Promise<ToolResult> => ({
      toolCallId: call.id,
      name: call.function.name,
      content: '12:00',
    }))

    const events: AgentEvent[] = []
    const context: AgentContext = {
      systemPrompt: 'You are a clock.',
      messages: [{ role: 'user', content: 'What time is it?' }],
      tools: [
        {
          type: 'function',
          function: { name: 'get_time', description: 'Get time', parameters: {} },
        },
      ],
    }
    const config: AgentLoopConfig = { executeTool, toolExecutionMode: 'sequential' }

    const result = await agentLoop(provider, context, config, (e) => events.push(e))

    // Tool executed exactly once.
    expect(executeTool).toHaveBeenCalledTimes(1)

    // Final transcript: user, assistant(tool_calls), tool, assistant(stop).
    expect(result.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant'])
    expect(result.at(-1)?.content).toBe('It is noon.')

    const types = events.map((e) => e.type)
    expect(types[0]).toBe('agent_start')
    expect(types.at(-1)).toBe('agent_end')
    expect(types).toContain('tool_call')
    expect(types).toContain('tool_result')

    // Usage accumulated across both turns.
    const end = events.at(-1)
    expect(end?.type === 'agent_end' && end.usage.totalTokens).toBe(43)
  })

  it('terminates immediately when the model returns no tool calls', async () => {
    const provider = scriptedProvider([
      {
        id: 'r1',
        model: 'deepseek-v4-pro',
        finishReason: 'stop',
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        message: { role: 'assistant', content: 'Hello!' },
      },
    ])

    const events: AgentEvent[] = []
    const result = await agentLoop(
      provider,
      { systemPrompt: 'hi', messages: [{ role: 'user', content: 'hi' }], tools: [] },
      {},
      (e) => events.push(e),
    )

    expect(result.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(events.filter((e) => e.type === 'turn_start')).toHaveLength(1)
  })

  it('captures tool executor failures as error results without crashing', async () => {
    const provider = scriptedProvider([
      {
        id: 'r1',
        model: 'deepseek-v4-pro',
        finishReason: 'tool_calls',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: 'c1', type: 'function', function: { name: 'boom', arguments: '{}' } },
          ],
        },
      },
      {
        id: 'r2',
        model: 'deepseek-v4-pro',
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        message: { role: 'assistant', content: 'done' },
      },
    ])

    const executeTool = vi.fn(async (): Promise<ToolResult> => {
      throw new Error('kaboom')
    })

    const events: AgentEvent[] = []
    const result = await agentLoop(
      provider,
      {
        systemPrompt: 's',
        messages: [{ role: 'user', content: 'go' }],
        tools: [{ type: 'function', function: { name: 'boom', description: '', parameters: {} } }],
      },
      { executeTool },
      (e) => events.push(e),
    )

    const toolResultEvent = events.find((e) => e.type === 'tool_result')
    expect(toolResultEvent?.type === 'tool_result' && toolResultEvent.result.isError).toBe(true)
    expect(toolResultEvent?.type === 'tool_result' && toolResultEvent.result.content).toBe('kaboom')
    expect(result.at(-1)?.content).toBe('done')
  })
})
