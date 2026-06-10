import { describe, expect, it, vi } from 'vitest'
import type {
  ChatRequest,
  ChatResponse,
  LLMProvider,
  StreamEvent,
} from '../llm/types.js'
import type { AgentContext, AgentEvent, ToolResult } from './types.js'
import { agentLoop } from './loop.js'

/** Scripted fake provider: replays ChatResponses, firing matching stream events. */
function makeFakeProvider(responses: ChatResponse[]): LLMProvider & { requests: ChatRequest[] } {
  let i = 0
  const requests: ChatRequest[] = []
  return {
    id: 'fake',
    requests,
    async chat(request: ChatRequest): Promise<ChatResponse> {
      requests.push(request)
      const response = responses[i++]
      if (!response) throw new Error('fake provider exhausted')
      return response
    },
    async stream(request: ChatRequest, onEvent: (ev: StreamEvent) => void): Promise<ChatResponse> {
      requests.push(request)
      const response = responses[i++]
      if (!response) throw new Error('fake provider exhausted')
      if (response.message.reasoning) {
        onEvent({ type: 'reasoning-delta', text: response.message.reasoning })
      }
      if (response.message.content) {
        onEvent({ type: 'text-delta', text: response.message.content })
      }
      for (const toolCall of response.message.tool_calls ?? []) {
        onEvent({ type: 'tool-call', toolCall })
      }
      onEvent({ type: 'finish', finishReason: response.finishReason, usage: response.usage })
      return response
    },
  }
}

function toolCallResponse(): ChatResponse {
  return {
    id: 'r1',
    model: 'fake-model',
    message: {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'get_time', arguments: '{}' },
        },
      ],
    },
    finishReason: 'tool_calls',
    usage: { promptTokens: 10, completionTokens: 4, totalTokens: 14 },
  }
}

function stopResponse(content = 'It is noon.'): ChatResponse {
  return {
    id: 'r2',
    model: 'fake-model',
    message: { role: 'assistant', content },
    finishReason: 'stop',
    usage: { promptTokens: 20, completionTokens: 6, totalTokens: 26 },
  }
}

function makeContext(): AgentContext {
  return {
    systemPrompt: 'You are a helpful agent.',
    messages: [{ role: 'user', content: 'What time is it?' }],
    tools: [
      {
        type: 'function',
        function: { name: 'get_time', description: 'Get the time', parameters: {} },
      },
    ],
  }
}

describe('agentLoop', () => {
  it('runs a tool-call turn then a stop turn', async () => {
    const provider = makeFakeProvider([toolCallResponse(), stopResponse()])
    const executor = vi.fn(async (call): Promise<ToolResult> => ({
      toolCallId: call.id,
      name: call.function.name,
      content: '12:00',
    }))
    const events: AgentEvent[] = []

    const transcript = await agentLoop(
      provider,
      makeContext(),
      { executeTool: executor },
      ev => events.push(ev),
    )

    expect(transcript.map(m => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant'])
    expect(executor).toHaveBeenCalledTimes(1)

    const toolMessage = transcript[2]!
    expect(toolMessage.tool_call_id).toBe('call_1')
    expect(toolMessage.name).toBe('get_time')
    expect(toolMessage.content).toBe('12:00')
    expect(toolMessage.createdAt).toBeTypeOf('number')

    const types = events.map(e => e.type)
    expect(types).toEqual([
      'agent_start',
      'turn_start',
      'message_start',
      'message_end',
      'tool_execution_start',
      'tool_execution_end',
      'turn_end',
      'turn_start',
      'message_start',
      'message_update',
      'message_end',
      'turn_end',
      'agent_end',
    ])

    const end = events.at(-1)
    expect(end).toMatchObject({
      type: 'agent_end',
      usage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 },
    })

    // System prompt is prepended on every request; tools sent with toolChoice auto.
    expect(provider.requests[0]!.messages[0]).toEqual({
      role: 'system',
      content: 'You are a helpful agent.',
    })
    expect(provider.requests[0]!.toolChoice).toBe('auto')
    // Second request includes the assistant tool-call message and the tool result.
    expect(provider.requests[1]!.messages.map(m => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'tool',
    ])
  })

  it('stops after a single turn when no tool calls are requested', async () => {
    const provider = makeFakeProvider([stopResponse('Hello!')])
    const events: AgentEvent[] = []

    const transcript = await agentLoop(
      provider,
      { systemPrompt: 'sys', messages: [{ role: 'user', content: 'hi' }], tools: [] },
      {},
      ev => events.push(ev),
    )

    expect(transcript.map(m => m.role)).toEqual(['user', 'assistant'])
    expect(events.filter(e => e.type === 'turn_start')).toHaveLength(1)
    expect(events.some(e => e.type === 'tool_execution_start')).toBe(false)
    // No tools → request omits tools/toolChoice.
    expect(provider.requests[0]!.tools).toBeUndefined()
    expect(provider.requests[0]!.toolChoice).toBeUndefined()
    // message_update carries the text delta.
    expect(events.find(e => e.type === 'message_update')).toEqual({
      type: 'message_update',
      delta: 'Hello!',
      channel: 'text',
    })
  })

  it('continues to completion when the executor throws, marking the result as error', async () => {
    const provider = makeFakeProvider([toolCallResponse(), stopResponse('Sorry, tool failed.')])
    const executor = vi.fn(async () => {
      throw new Error('tool exploded')
    })
    const events: AgentEvent[] = []

    const transcript = await agentLoop(
      provider,
      makeContext(),
      { executeTool: executor, toolExecutionMode: 'sequential' },
      ev => events.push(ev),
    )

    const endEvent = events.find(e => e.type === 'tool_execution_end')
    expect(endEvent).toBeDefined()
    if (endEvent?.type === 'tool_execution_end') {
      expect(endEvent.result.isError).toBe(true)
      expect(endEvent.result.content).toBe('tool exploded')
      expect(endEvent.result.toolCallId).toBe('call_1')
    }

    expect(transcript.map(m => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant'])
    expect(transcript[2]!.content).toBe('tool exploded')
    expect(events.at(-1)?.type).toBe('agent_end')
    expect(events.some(e => e.type === 'error')).toBe(false)
  })
})
