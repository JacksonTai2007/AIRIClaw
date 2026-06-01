/**
 * The digital-human persona, distilled from Project AIRI's `AiriCard`. A
 * `CharacterCard` carries identity (name/description/personality), conversation
 * seeds (greetings/examples), the system-prompt scaffold, and the runtime
 * `modules` config that selects the consciousness / speech / avatar backends.
 */

/** Runtime backend selection for the character's faculties. */
export interface CharacterModules {
  /** The "brain" — the LLM that drives reasoning and chat. */
  consciousness: { provider: string; model: string }
  /** Optional text-to-speech voice configuration. */
  speech?: {
    provider: string
    model: string
    voiceId: string
    pitch?: number
    rate?: number
    language?: string
  }
  /** Optional avatar model (Live2D or VRM), loaded from a file or URL. */
  avatar?: {
    kind: 'live2d' | 'vrm'
    source: 'file' | 'url'
    file?: string
    url?: string
  }
}

/** A complete digital-human character definition. */
export interface CharacterCard {
  name: string
  version: string
  description: string
  creator?: string
  personality: string
  scenario?: string
  greetings: string[]
  systemPrompt: string
  postHistoryInstructions?: string
  /** Few-shot dialogue examples; each example is a list of turn strings. */
  messageExamples?: string[][]
  modules: CharacterModules
}

/** The built-in default persona. */
export const DEFAULT_CHARACTER: CharacterCard = {
  name: 'AIRI',
  version: '1.0.0',
  description:
    'AIRI is a local-first digital-human companion: a warm, curious AI who lives '
    + 'alongside you, remembers what matters, and helps you think and build.',
  creator: 'AIRIClaw',
  personality:
    'Friendly, curious, and quietly confident. Speaks plainly and warmly, enjoys '
    + 'learning new things, and is happy to dig into hard problems together. Honest '
    + 'about uncertainty and never pretends to know what it does not.',
  scenario: '',
  greetings: ['Hi! I\'m AIRI. What are we working on today?'],
  systemPrompt:
    'You are AIRI, a helpful and personable digital-human assistant. Stay in '
    + 'character, be concise, and use the tools and memories available to you.',
  postHistoryInstructions: '',
  messageExamples: [],
  modules: {
    consciousness: { provider: 'deepseek', model: 'deepseek-v4-pro' },
  },
}

/**
 * Validate a partial character card (an arbitrary JSON object) and merge it
 * over {@link DEFAULT_CHARACTER}. Top-level keys are shallow-merged; `modules`
 * is merged one level deep so a partial `modules` does not wipe the default
 * consciousness config. Throws if the resulting name or personality is empty.
 */
export function loadCharacterCard(json: unknown): CharacterCard {
  if (json === null || typeof json !== 'object' || Array.isArray(json))
    throw new Error('loadCharacterCard: expected a JSON object')

  const partial = json as Partial<CharacterCard>

  const mergedModules: CharacterModules = {
    ...DEFAULT_CHARACTER.modules,
    ...(partial.modules ?? {}),
  }

  const card: CharacterCard = {
    ...DEFAULT_CHARACTER,
    ...partial,
    modules: mergedModules,
  }

  if (!card.modules.consciousness?.provider || !card.modules.consciousness?.model)
    throw new Error('loadCharacterCard: modules.consciousness.provider and .model are required')

  if (typeof card.name !== 'string' || card.name.trim() === '')
    throw new Error('loadCharacterCard: character "name" must be a non-empty string')

  if (typeof card.personality !== 'string' || card.personality.trim() === '')
    throw new Error('loadCharacterCard: character "personality" must be a non-empty string')

  return card
}
