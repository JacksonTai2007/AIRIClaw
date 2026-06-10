import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ChatRequest, ChatResponse, LLMProvider, StreamEvent } from '../llm/types.js'
import { DEFAULT_CONFIG, type AppConfig } from '../config/schema.js'
import { SkillRegistry } from '../skills/registry.js'
import { MemoryStore } from '../memory/store.js'
import { EventBus } from '../events/bus.js'
import type { OutputChatCompleteEvent } from '../events/types.js'
import { Assistant } from './assistant.js'

/** Replays scripted responses turn by turn, firing matching stream events. */
function scriptedProvider(responses: ChatResponse[]): LLMProvider {
  let i = 0
  return {
    id: 'fake',
    async chat() {
      return responses[i++]!
    },
    async stream(_req: ChatRequest, onEvent: (event: StreamEvent) => void): Promise<ChatResponse> {
      const response = responses[i++]!
      if (response.message.content) onEvent({ type: 'text-delta', text: response.message.content })
      for (const tc of response.message.tool_calls ?? []) {
        onEvent({ type: 'tool-call', toolCall: tc })
      }
      onEvent({ type: 'finish', finishReason: response.finishReason, usage: response.usage })
      return response
    },
  }
}

function registryWithSkill(): SkillRegistry {
  const registry = new SkillRegistry()
  registry.add({
    manifest: {
      name: 'weather',
      description: 'Look up the weather',
      policy: { userInvocable: true, disableModelInvocation: false },
    },
    instructions: '# Weather\nRun `curl wttr.in` to fetch the forecast.',
    sourcePath: '/skills/weather/SKILL.md',
    baseDir: '/skills/weather',
    raw: '',
  })
  return registry
}

function response(partial: Partial<ChatResponse> & { message: ChatResponse['message'] }): ChatResponse {
  return {
    id: 'r',
    model: 'deepseek-v4-pro',
    finishReason: 'stop',
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    ...partial,
  }
}

describe('Assistant', () => {
  let dir: string
  let config: AppConfig

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'airiclaw-rt-'))
    config = { ...DEFAULT_CONFIG, memoryDir: dir, skillsDir: join(dir, 'skills') }
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('runs a plain turn, streaming deltas and emitting chat:complete', async () => {
    const provider = scriptedProvider([
      response({
        message: { role: 'assistant', content: 'Hi there!' },
        usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 },
      }),
    ])
    const bus = new EventBus()
    const deltas: string[] = []
    const completes: OutputChatCompleteEvent[] = []
    bus.on('output:gen-ai:chat:delta', ({ delta }) => {
      deltas.push(delta)
    })
    bus.on('output:gen-ai:chat:complete', (e) => {
      completes.push(e)
    })

    const assistant = new Assistant({
      config,
      provider,
      registry: new SkillRegistry(),
      memory: new MemoryStore(MemoryStore.defaultPaths(dir)),
      bus,
    })

    const result = await assistant.chat('hello')
    expect(result.text).toBe('Hi there!')
    expect(deltas.join('')).toBe('Hi there!')
    expect(completes).toHaveLength(1)
    expect(completes[0]?.usage.totalTokens).toBe(6)
  })

  it('invokes a skill tool, feeding its SKILL.md body back to the model', async () => {
    const provider = scriptedProvider([
      response({
        finishReason: 'tool_calls',
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'c1',
              type: 'function',
              function: { name: 'skill_weather', arguments: '{"args":"london"}' },
            },
          ],
        },
      }),
      response({ message: { role: 'assistant', content: 'It is sunny in London.' } }),
    ])

    const assistant = new Assistant({
      config,
      provider,
      registry: registryWithSkill(),
      memory: new MemoryStore(MemoryStore.defaultPaths(dir)),
      bus: new EventBus(),
    })

    const result = await assistant.chat('weather in london?')
    expect(result.text).toBe('It is sunny in London.')

    const toolMessage = result.messages.find((m) => m.role === 'tool')
    expect(toolMessage?.content).toContain('curl wttr.in')
  })

  it('persists the exchange to a daily note', async () => {
    const provider = scriptedProvider([
      response({ message: { role: 'assistant', content: 'Noted.' } }),
    ])
    const assistant = new Assistant({
      config,
      provider,
      registry: new SkillRegistry(),
      memory: new MemoryStore(MemoryStore.defaultPaths(dir)),
      bus: new EventBus(),
    })

    await assistant.chat('remember milk')

    const today = new Date().toISOString().slice(0, 10)
    const note = await readFile(join(dir, 'daily', `${today}.md`), 'utf8')
    expect(note).toContain('remember milk')
    expect(note).toContain('Noted.')
  })

  it('keeps conversation history across turns', async () => {
    const provider = scriptedProvider([
      response({ message: { role: 'assistant', content: 'First.' } }),
      response({ message: { role: 'assistant', content: 'Second.' } }),
    ])
    const assistant = new Assistant({
      config,
      provider,
      registry: new SkillRegistry(),
      memory: new MemoryStore(MemoryStore.defaultPaths(dir)),
      bus: new EventBus(),
    })

    await assistant.chat('one')
    const second = await assistant.chat('two')
    // Second turn's transcript includes the full prior history.
    const roles = second.messages.map((m) => m.role)
    expect(roles).toEqual(['user', 'assistant', 'user', 'assistant'])
  })
})
