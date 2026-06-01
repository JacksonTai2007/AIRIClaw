import { describe, expect, it } from 'vitest'

import { DEFAULT_CHARACTER, loadCharacterCard } from './card.js'

describe('loadCharacterCard', () => {
  it('merges a partial card over the default', () => {
    const card = loadCharacterCard({
      name: 'Nova',
      greetings: ['hey'],
    })

    expect(card.name).toBe('Nova')
    expect(card.greetings).toEqual(['hey'])
    // Untouched fields fall back to the default.
    expect(card.personality).toBe(DEFAULT_CHARACTER.personality)
    // Modules are merged one level deep, preserving the default consciousness.
    expect(card.modules.consciousness).toEqual(DEFAULT_CHARACTER.modules.consciousness)
  })

  it('deep-merges modules so a partial modules keeps defaults', () => {
    const card = loadCharacterCard({
      modules: {
        speech: { provider: 'elevenlabs', model: 'eleven_v2', voiceId: 'alloy' },
      } as never,
    })

    expect(card.modules.consciousness).toEqual(DEFAULT_CHARACTER.modules.consciousness)
    expect(card.modules.speech).toEqual({
      provider: 'elevenlabs',
      model: 'eleven_v2',
      voiceId: 'alloy',
    })
  })

  it('throws when name is emptied', () => {
    expect(() => loadCharacterCard({ name: '   ' })).toThrow(/name/)
  })

  it('throws when personality is emptied', () => {
    expect(() => loadCharacterCard({ personality: '' })).toThrow(/personality/)
  })

  it('throws on non-object input', () => {
    expect(() => loadCharacterCard(null)).toThrow()
    expect(() => loadCharacterCard([])).toThrow()
  })
})
