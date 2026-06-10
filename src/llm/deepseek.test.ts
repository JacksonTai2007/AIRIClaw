import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    constructorArgs: [] as unknown[],
    create: vi.fn(),
  }
})

vi.mock('openai', () => {
  class FakeOpenAI {
    chat = { completions: { create: mocks.create } }
    constructor(opts: unknown) {
      mocks.constructorArgs.push(opts)
    }
  }
  return { default: FakeOpenAI }
})

import { DeepSeekProvider } from './deepseek.js'
import { DEEPSEEK_DEFAULTS } from './types.js'
import type { LLMConfig } from './types.js'

function makeConfig(overrides: Partial<LLMConfig> = {}): LLMConfig {
  return { provider: 'deepseek', model: '', ...overrides }
}

beforeEach(() => {
  mocks.constructorArgs.length = 0
  mocks.create.mockReset()
})

describe('DeepSeekProvider construction', () => {
  it('applies defaults: model deepseek-v4-pro, thinking think_high, base URL', () => {
    const provider = new DeepSeekProvider(makeConfig())
    expect(provider.id).toBe('deepseek')
    expect(provider.getModel()).toBe(DEEPSEEK_DEFAULTS.MODEL_PRO)
    expect(provider.getModel()).toBe('deepseek-v4-pro')
    expect(provider.getThinkingMode()).toBe('think_high')
    expect(mocks.constructorArgs[0]).toMatchObject({
      baseURL: 'https://api.deepseek.com',
    })
  })

  it('falls back to the default model when model is an empty string (|| semantics)', () => {
    const provider = new DeepSeekProvider(makeConfig({ model: '' }))
    expect(provider.getModel()).toBe('deepseek-v4-pro')
  })

  it('uses an explicit model and thinking mode when provided', () => {
    const provider = new DeepSeekProvider(
      makeConfig({ model: 'deepseek-v4-flash', thinkingMode: 'non_think' }),
    )
    expect(provider.getModel()).toBe('deepseek-v4-flash')
    expect(provider.getThinkingMode()).toBe('non_think')
  })

  it('passes a custom baseURL and apiKey through to the OpenAI client', () => {
    new DeepSeekProvider(makeConfig({ baseURL: 'https://proxy.example.com/v1', apiKey: 'sk-test' }))
    expect(mocks.constructorArgs[0]).toMatchObject({
      apiKey: 'sk-test',
      baseURL: 'https://proxy.example.com/v1',
    })
  })
})

describe('DeepSeekProvider.chat()', () => {
  it('maps a plain text response', async () => {
    mocks.create.mockResolvedValueOnce({
      id: 'resp-1',
      model: 'deepseek-v4-pro',
      choices: [
        {
          message: { role: 'assistant', content: 'Hello there' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    })

    const provider = new DeepSeekProvider(makeConfig())
    const response = await provider.chat({ messages: [{ role: 'user', content: 'hi' }] })

    expect(response).toEqual({
      id: 'resp-1',
      model: 'deepseek-v4-pro',
      message: { role: 'assistant', content: 'Hello there' },
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    })

    const [body] = mocks.create.mock.calls[0]!
    expect(body.model).toBe('deepseek-v4-pro')
    expect(body.temperature).toBe(0.7)
    expect(body.max_tokens).toBe(4096)
    expect(body.extra_body).toEqual({ thinking_mode: 'think_high' })
  })

  it('maps tool_calls and reasoning_content', async () => {
    mocks.create.mockResolvedValueOnce({
      id: 'resp-2',
      model: 'deepseek-v4-pro',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            reasoning_content: 'thinking about the weather',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'get_weather', arguments: '{"city":"Tokyo"}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
    })

    const provider = new DeepSeekProvider(makeConfig())
    const response = await provider.chat({ messages: [{ role: 'user', content: 'weather?' }] })

    expect(response.message.content).toBe('')
    expect(response.message.reasoning).toBe('thinking about the weather')
    expect(response.message.tool_calls).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"city":"Tokyo"}' },
      },
    ])
    expect(response.finishReason).toBe('tool_calls')
  })

  it('maps finish_reason length and defaults unknown reasons to stop', async () => {
    const base = {
      id: 'resp-x',
      model: 'deepseek-v4-pro',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }
    mocks.create.mockResolvedValueOnce({
      ...base,
      choices: [{ message: { role: 'assistant', content: 'cut' }, finish_reason: 'length' }],
    })
    mocks.create.mockResolvedValueOnce({
      ...base,
      choices: [
        { message: { role: 'assistant', content: 'odd' }, finish_reason: 'content_filter' },
      ],
    })

    const provider = new DeepSeekProvider(makeConfig())
    const r1 = await provider.chat({ messages: [{ role: 'user', content: 'a' }] })
    const r2 = await provider.chat({ messages: [{ role: 'user', content: 'b' }] })
    expect(r1.finishReason).toBe('length')
    expect(r2.finishReason).toBe('stop')
  })

  it('zero-fills usage when missing', async () => {
    mocks.create.mockResolvedValueOnce({
      id: 'resp-3',
      model: 'deepseek-v4-pro',
      choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
    })

    const provider = new DeepSeekProvider(makeConfig())
    const response = await provider.chat({ messages: [{ role: 'user', content: 'hi' }] })
    expect(response.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 })
  })
})

describe('DeepSeekProvider.stream()', () => {
  function fakeStream(chunks: unknown[]) {
    return {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) yield chunk
      },
    }
  }

  it('accumulates text, reasoning, fragmented tool calls, and usage', async () => {
    mocks.create.mockResolvedValueOnce(
      fakeStream([
        {
          id: 'resp-s',
          model: 'deepseek-v4-pro',
          choices: [{ delta: { reasoning_content: 'thi' }, finish_reason: null }],
        },
        {
          id: 'resp-s',
          model: 'deepseek-v4-pro',
          choices: [{ delta: { reasoning_content: 'nk' }, finish_reason: null }],
        },
        {
          id: 'resp-s',
          model: 'deepseek-v4-pro',
          choices: [{ delta: { content: 'Hel' }, finish_reason: null }],
        },
        {
          id: 'resp-s',
          model: 'deepseek-v4-pro',
          choices: [{ delta: { content: 'lo' }, finish_reason: null }],
        },
        {
          id: 'resp-s',
          model: 'deepseek-v4-pro',
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'call_a', type: 'function', function: { name: 'lookup', arguments: '{"q":' } },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: 'resp-s',
          model: 'deepseek-v4-pro',
          choices: [
            {
              delta: { tool_calls: [{ index: 0, function: { arguments: '"x"}' } }] },
              finish_reason: 'tool_calls',
            },
          ],
        },
        {
          id: 'resp-s',
          model: 'deepseek-v4-pro',
          choices: [],
          usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
        },
      ]),
    )

    const provider = new DeepSeekProvider(makeConfig())
    const events: unknown[] = []
    const response = await provider.stream(
      { messages: [{ role: 'user', content: 'hi' }] },
      ev => events.push(ev),
    )

    expect(events).toEqual([
      { type: 'reasoning-delta', text: 'thi' },
      { type: 'reasoning-delta', text: 'nk' },
      { type: 'text-delta', text: 'Hel' },
      { type: 'text-delta', text: 'lo' },
      {
        type: 'tool-call',
        toolCall: {
          id: 'call_a',
          type: 'function',
          function: { name: 'lookup', arguments: '{"q":"x"}' },
        },
      },
      {
        type: 'finish',
        finishReason: 'tool_calls',
        usage: { promptTokens: 12, completionTokens: 7, totalTokens: 19 },
      },
    ])

    expect(response.id).toBe('resp-s')
    expect(response.message.content).toBe('Hello')
    expect(response.message.reasoning).toBe('think')
    expect(response.message.tool_calls).toHaveLength(1)
    expect(response.finishReason).toBe('tool_calls')
    expect(response.usage).toEqual({ promptTokens: 12, completionTokens: 7, totalTokens: 19 })

    const [body] = mocks.create.mock.calls[0]!
    expect(body.stream).toBe(true)
    expect(body.stream_options).toEqual({ include_usage: true })
    expect(body.extra_body).toEqual({ thinking_mode: 'think_high' })
  })

  it('emits an error event and rethrows on failure', async () => {
    const boom = new Error('network down')
    mocks.create.mockRejectedValueOnce(boom)

    const provider = new DeepSeekProvider(makeConfig())
    const events: unknown[] = []
    await expect(
      provider.stream({ messages: [{ role: 'user', content: 'hi' }] }, ev => events.push(ev)),
    ).rejects.toThrow('network down')
    expect(events).toEqual([{ type: 'error', error: boom }])
  })
})
