import { beforeEach, describe, expect, it, vi } from 'vitest'

// Capture constructor args and stub the chat.completions.create method.
const createMock = vi.fn()
const constructorMock = vi.fn()

vi.mock('openai', () => {
  class FakeOpenAI {
    chat: { completions: { create: typeof createMock } }
    constructor(opts: unknown) {
      constructorMock(opts)
      this.chat = { completions: { create: createMock } }
    }
  }
  return { default: FakeOpenAI }
})

import { DeepSeekProvider } from './deepseek.js'
import { DEEPSEEK_DEFAULTS, type ChatRequest, type LLMConfig, type StreamEvent } from './types.js'

const baseConfig: LLMConfig = { provider: 'deepseek', model: '' as unknown as string }

const sampleRequest: ChatRequest = {
  messages: [{ role: 'user', content: 'hi' }],
}

beforeEach(() => {
  createMock.mockReset()
  constructorMock.mockReset()
  delete process.env.DEEPSEEK_API_KEY
})

describe('DeepSeekProvider construction & defaults', () => {
  it('uses DeepSeek defaults for baseURL, model, and thinking mode', () => {
    new DeepSeekProvider({ provider: 'deepseek', model: undefined as unknown as string })
    expect(constructorMock).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: DEEPSEEK_DEFAULTS.BASE_URL }),
    )
  })

  it('falls back to DEEPSEEK_API_KEY env var when apiKey is absent', () => {
    process.env.DEEPSEEK_API_KEY = 'env-key'
    new DeepSeekProvider({ provider: 'deepseek', model: 'm' })
    expect(constructorMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'env-key' }))
  })

  it('prefers explicit config over defaults', () => {
    new DeepSeekProvider({
      provider: 'deepseek',
      model: 'custom',
      apiKey: 'k',
      baseURL: 'https://example.test',
    })
    expect(constructorMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'k', baseURL: 'https://example.test' }),
    )
  })

  it('exposes id "deepseek"', () => {
    const p = new DeepSeekProvider({ provider: 'deepseek', model: 'm' })
    expect(p.id).toBe('deepseek')
  })
})

describe('DeepSeekProvider.chat', () => {
  it('sends model/thinking_mode and maps the response', async () => {
    createMock.mockResolvedValue({
      id: 'resp-1',
      model: DEEPSEEK_DEFAULTS.MODEL_PRO,
      choices: [
        {
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'hello', reasoning_content: 'because' },
        },
      ],
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    })

    const provider = new DeepSeekProvider(baseConfig)
    const res = await provider.chat(sampleRequest)

    // Defaults applied to the outgoing call.
    const args = createMock.mock.calls[0]![0]
    expect(args.model).toBe(DEEPSEEK_DEFAULTS.MODEL_PRO)
    expect(args.extra_body).toEqual({ thinking_mode: DEEPSEEK_DEFAULTS.THINKING_MODE })
    expect(args.temperature).toBe(0.7)
    expect(args.max_tokens).toBe(4096)

    // Response mapped onto our contract.
    expect(res.id).toBe('resp-1')
    expect(res.finishReason).toBe('stop')
    expect(res.message.content).toBe('hello')
    expect(res.message.reasoning).toBe('because')
    expect(res.usage).toEqual({ promptTokens: 3, completionTokens: 4, totalTokens: 7 })
  })

  it('maps tool_calls and finish_reason "tool_calls"', async () => {
    createMock.mockResolvedValue({
      id: 'resp-2',
      model: DEEPSEEK_DEFAULTS.MODEL_PRO,
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id: 'c1', type: 'function', function: { name: 'f', arguments: '{"a":1}' } },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    })

    const provider = new DeepSeekProvider(baseConfig)
    const res = await provider.chat(sampleRequest)

    expect(res.finishReason).toBe('tool_calls')
    expect(res.message.content).toBe('')
    expect(res.message.tool_calls).toEqual([
      { id: 'c1', type: 'function', function: { name: 'f', arguments: '{"a":1}' } },
    ])
  })

  it('rethrows network errors', async () => {
    createMock.mockRejectedValue(new Error('network down'))
    const provider = new DeepSeekProvider(baseConfig)
    await expect(provider.chat(sampleRequest)).rejects.toThrow('network down')
  })
})

describe('DeepSeekProvider.stream', () => {
  function makeStream(chunks: unknown[]): AsyncIterable<unknown> {
    return {
      async *[Symbol.asyncIterator]() {
        for (const c of chunks) yield c
      },
    }
  }

  it('emits deltas, accumulates tool calls, and assembles the response', async () => {
    createMock.mockResolvedValue(
      makeStream([
        { id: 'rid', model: 'deepseek-v4-pro', choices: [{ delta: { reasoning_content: 'th' } }] },
        { id: 'rid', model: 'deepseek-v4-pro', choices: [{ delta: { content: 'Hel' } }] },
        { id: 'rid', model: 'deepseek-v4-pro', choices: [{ delta: { content: 'lo' } }] },
        {
          id: 'rid',
          model: 'deepseek-v4-pro',
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'c1', function: { name: 'do_it', arguments: '{"x"' } },
                ],
              },
            },
          ],
        },
        {
          id: 'rid',
          model: 'deepseek-v4-pro',
          choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':1}' } }] } }],
        },
        {
          id: 'rid',
          model: 'deepseek-v4-pro',
          choices: [{ delta: {}, finish_reason: 'tool_calls' }],
          usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
        },
      ]),
    )

    const provider = new DeepSeekProvider(baseConfig)
    const events: StreamEvent[] = []
    const res = await provider.stream(sampleRequest, (e) => events.push(e))

    // Outgoing call had stream:true.
    expect(createMock.mock.calls[0]![0].stream).toBe(true)

    // Events surfaced in order.
    const types = events.map((e) => e.type)
    expect(types).toContain('reasoning-delta')
    expect(types).toContain('text-delta')
    expect(types).toContain('tool-call')
    expect(types.at(-1)).toBe('finish')

    // Assembled response.
    expect(res.id).toBe('rid')
    expect(res.message.content).toBe('Hello')
    expect(res.message.reasoning).toBe('th')
    expect(res.finishReason).toBe('tool_calls')
    expect(res.message.tool_calls).toEqual([
      { id: 'c1', type: 'function', function: { name: 'do_it', arguments: '{"x":1}' } },
    ])
    expect(res.usage).toEqual({ promptTokens: 2, completionTokens: 3, totalTokens: 5 })
  })

  it('emits an error event and rethrows when the stream call fails', async () => {
    createMock.mockRejectedValue(new Error('boom'))
    const provider = new DeepSeekProvider(baseConfig)
    const events: StreamEvent[] = []
    await expect(provider.stream(sampleRequest, (e) => events.push(e))).rejects.toThrow('boom')
    expect(events.some((e) => e.type === 'error')).toBe(true)
  })
})
