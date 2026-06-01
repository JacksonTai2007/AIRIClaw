import { describe, expect, it } from 'vitest'

import { DEFAULT_CHARACTER, type CharacterCard } from './card.js'
import { buildSystemPrompt } from './prompt.js'

function makeCard(overrides: Partial<CharacterCard> = {}): CharacterCard {
  return { ...DEFAULT_CHARACTER, ...overrides }
}

describe('buildSystemPrompt', () => {
  it('fuses components in the documented order', () => {
    const card = makeCard({
      systemPrompt: 'SYS',
      description: 'DESC',
      personality: 'PERS',
      scenario: 'SCEN',
      postHistoryInstructions: 'POST',
    })

    const out = buildSystemPrompt(card, {
      skills: '<available_skills>SK</available_skills>',
      memory: 'MEM',
      contexts: ['CTX1', 'CTX2'],
    })

    expect(out).toBe(
      [
        'SYS',
        'DESC',
        'Personality:\nPERS',
        'Scenario:\nSCEN',
        '<available_skills>SK</available_skills>',
        '# Long-term memory\nMEM',
        'CTX1',
        'CTX2',
        'POST',
      ].join('\n\n'),
    )
  })

  it('omits empty parts', () => {
    const card = makeCard({
      systemPrompt: 'SYS',
      description: '',
      personality: 'PERS',
      scenario: '',
      postHistoryInstructions: '',
    })

    const out = buildSystemPrompt(card)

    expect(out).toBe(['SYS', 'Personality:\nPERS'].join('\n\n'))
    expect(out).not.toContain('Scenario:')
    expect(out).not.toContain('Long-term memory')
  })

  it('includes skills and memory blocks when provided', () => {
    const card = makeCard({ systemPrompt: 'SYS' })
    const out = buildSystemPrompt(card, {
      skills: '<available_skills>do_thing</available_skills>',
      memory: 'user likes tea',
    })

    expect(out).toContain('<available_skills>do_thing</available_skills>')
    expect(out).toContain('# Long-term memory\nuser likes tea')
  })
})
