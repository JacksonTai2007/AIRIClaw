/**
 * Fuses a {@link CharacterCard} plus runtime injections (skills, memory,
 * situational contexts) into a single system prompt. Mirrors AIRI's
 * `systemPrompt` computed getter: components are concatenated in a fixed order
 * with blank entries filtered out and joined by double newlines.
 */

import type { CharacterCard } from './card.js'

/** Optional runtime blocks injected around the static card content. */
export interface SystemPromptParts {
  /** The `<available_skills>` XML block describing callable skills. */
  skills?: string
  /** Recalled long-term memory text. */
  memory?: string
  /** Situational context strings (memory recall, awareness updates...). */
  contexts?: string[]
}

export function buildSystemPrompt(card: CharacterCard, parts?: SystemPromptParts): string {
  const components: Array<string | undefined> = [
    card.systemPrompt,
    card.description,
    card.personality ? `Personality:\n${card.personality}` : undefined,
    card.scenario ? `Scenario:\n${card.scenario}` : undefined,
    parts?.skills,
    parts?.memory ? `# Long-term memory\n${parts.memory}` : undefined,
    ...(parts?.contexts ?? []),
    card.postHistoryInstructions,
  ]

  return components
    .map(c => (typeof c === 'string' ? c.trim() : ''))
    .filter(c => c.length > 0)
    .join('\n\n')
}
