/**
 * System-prompt assembly — mirrors AIRI v0.10.2's `systemPrompt` computed
 * getter (systemPrompt + description + personality joined with blank lines),
 * extended with skills / long-term memory / runtime-context lanes.
 */

import type { CharacterCard } from './card.js'

/** Dynamic segments injected alongside the static card. */
export interface SystemPromptParts {
  /** Rendered skill instructions. */
  skills?: string
  /** Long-term memory recall (MEMORY.md excerpts). */
  memory?: string
  /** Ad-hoc runtime contexts (AIRI `context:update` lane). */
  contexts?: string[]
}

function isPresent(segment: string | undefined): segment is string {
  return typeof segment === 'string' && segment.trim() !== ''
}

/** Build the full system prompt for one agent run. */
export function buildSystemPrompt(card: CharacterCard, parts?: SystemPromptParts): string {
  const segments: (string | undefined)[] = [
    card.systemPrompt,
    card.description,
    isPresent(card.personality) ? `Personality:\n${card.personality}` : undefined,
    isPresent(card.scenario) ? `Scenario:\n${card.scenario}` : undefined,
    parts?.skills,
    isPresent(parts?.memory) ? `# Long-term memory\n${parts.memory}` : undefined,
    ...(parts?.contexts ?? []),
    card.postHistoryInstructions,
  ]

  return segments.filter(isPresent).join('\n\n')
}
