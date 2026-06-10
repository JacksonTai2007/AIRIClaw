import { describe, expect, it } from 'vitest'

import { DEFAULT_CHARACTER, loadCharacterCard } from './card.js'

describe('DEFAULT_CHARACTER', () => {
  it('is a valid card', () => {
    expect(DEFAULT_CHARACTER.name).toBe('AIRI')
    expect(DEFAULT_CHARACTER.version).toBe('2.0.0')
    expect(DEFAULT_CHARACTER.personality.trim()).not.toBe('')
    expect(DEFAULT_CHARACTER.greetings).toHaveLength(1)
    expect(DEFAULT_CHARACTER.modules.consciousness).toEqual({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
    })
    // Round-trips through the loader unchanged.
    expect(loadCharacterCard({ ...DEFAULT_CHARACTER })).toEqual(DEFAULT_CHARACTER)
  })
})

describe('loadCharacterCard', () => {
  it('shallow-merges partial input over the default card', () => {
    const card = loadCharacterCard({ name: 'Neko', description: 'A cat.' })

    expect(card.name).toBe('Neko')
    expect(card.description).toBe('A cat.')
    // Untouched fields keep default values.
    expect(card.version).toBe(DEFAULT_CHARACTER.version)
    expect(card.personality).toBe(DEFAULT_CHARACTER.personality)
    expect(card.greetings).toEqual(DEFAULT_CHARACTER.greetings)
    expect(card.systemPrompt).toBe(DEFAULT_CHARACTER.systemPrompt)
  })

  it('merges modules one level deep', () => {
    const card = loadCharacterCard({
      modules: {
        speech: { provider: 'elevenlabs', model: 'eleven_v3', voiceId: 'alloy' },
      },
    })

    // Default consciousness survives a modules override that omits it.
    expect(card.modules.consciousness).toEqual(DEFAULT_CHARACTER.modules.consciousness)
    expect(card.modules.speech).toEqual({
      provider: 'elevenlabs',
      model: 'eleven_v3',
      voiceId: 'alloy',
    })

    // Providing consciousness replaces it wholesale (one level deep, not two).
    const replaced = loadCharacterCard({
      modules: { consciousness: { provider: 'openai', model: 'gpt-4o' } },
    })
    expect(replaced.modules.consciousness).toEqual({ provider: 'openai', model: 'gpt-4o' })
  })

  it('throws on blank name', () => {
    expect(() => loadCharacterCard({ name: '' })).toThrow(/name/)
    expect(() => loadCharacterCard({ name: '   ' })).toThrow(/name/)
  })

  it('throws on blank personality', () => {
    expect(() => loadCharacterCard({ personality: ' ' })).toThrow(/personality/)
  })

  it('throws on non-object input', () => {
    expect(() => loadCharacterCard(null)).toThrow(/plain object/)
    expect(() => loadCharacterCard('AIRI')).toThrow(/plain object/)
    expect(() => loadCharacterCard(42)).toThrow(/plain object/)
    expect(() => loadCharacterCard([{ name: 'AIRI' }])).toThrow(/plain object/)
    expect(() => loadCharacterCard(undefined)).toThrow(/plain object/)
  })
})
