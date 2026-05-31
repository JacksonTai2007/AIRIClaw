import { describe, it, expect } from 'vitest'
import { DeepSeekClient } from './client.js'
import { DEEPSEEK_DEFAULTS } from '@airiclaw/types'

describe('DeepSeekClient', () => {
  it('initializes with default config', () => {
    const client = new DeepSeekClient({
      provider: 'deepseek',
      model: DEEPSEEK_DEFAULTS.MODEL_PRO,
      apiKey: 'test-key',
    })
    expect(client.getModel()).toBe('deepseek-v4-pro')
    expect(client.getThinkingMode()).toBe('think_high')
  })

  it('accepts custom model and thinking mode', () => {
    const client = new DeepSeekClient({
      provider: 'deepseek',
      model: DEEPSEEK_DEFAULTS.MODEL_FLASH,
      apiKey: 'test-key',
      thinkingMode: 'think_max',
    })
    expect(client.getModel()).toBe('deepseek-v4-flash')
    expect(client.getThinkingMode()).toBe('think_max')
  })

  it('uses custom baseURL', () => {
    const client = new DeepSeekClient({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      apiKey: 'test-key',
      baseURL: 'https://custom.api.example.com',
    })
    expect(client.getModel()).toBe('deepseek-v4-pro')
  })
})
