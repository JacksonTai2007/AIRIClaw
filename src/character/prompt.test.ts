import type { CharacterCard } from './card.js'

import { describe, expect, it } from 'vitest'

import { buildSystemPrompt } from './prompt.js'

const card: CharacterCard = {
  name: 'Test',
  version: '1.0.0',
  description: 'DESC',
  personality: 'PERSONA',
  scenario: 'SCENE',
  greetings: ['hi'],
  systemPrompt: 'SYSTEM',
  postHistoryInstructions: 'POST',
  modules: { consciousness: { provider: 'deepseek', model: 'deepseek-v4-pro' } },
}

describe('buildSystemPrompt', () => {
  it('joins all segments in exact order with blank lines', () => {
    const prompt = buildSystemPrompt(card, {
      skills: 'SKILLS',
      memory: 'MEMORY',
      contexts: ['CTX1', 'CTX2'],
    })

    expect(prompt).toBe([
      'SYSTEM',
      'DESC',
      'Personality:\nPERSONA',
      'Scenario:\nSCENE',
      'SKILLS',
      '# Long-term memory\nMEMORY',
      'CTX1',
      'CTX2',
      'POST',
    ].join('\n\n'))
  })

  it('omits empty and blank segments', () => {
    const sparse: CharacterCard = {
      ...card,
      systemPrompt: '',
      scenario: '   ',
      postHistoryInstructions: undefined,
    }

    const prompt = buildSystemPrompt(sparse, {
      skills: '',
      contexts: ['', '  ', 'CTX'],
    })

    expect(prompt).toBe('DESC\n\nPersonality:\nPERSONA\n\nCTX')
  })

  it('works with no parts at all', () => {
    expect(buildSystemPrompt(card)).toBe(
      'SYSTEM\n\nDESC\n\nPersonality:\nPERSONA\n\nScenario:\nSCENE\n\nPOST',
    )
  })

  it('includes the memory header only when memory is non-empty', () => {
    expect(buildSystemPrompt(card, { memory: 'remember this' }))
      .toContain('# Long-term memory\nremember this')

    expect(buildSystemPrompt(card)).not.toContain('# Long-term memory')
    expect(buildSystemPrompt(card, { memory: '' })).not.toContain('# Long-term memory')
    expect(buildSystemPrompt(card, { memory: '   ' })).not.toContain('# Long-term memory')
  })
})
