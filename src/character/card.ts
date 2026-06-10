/**
 * Character card — AIRI v0.10.2 `AiriCard` flattened for a server-side runtime.
 *
 * Mirrors the shape of `@proj-airi/ccc`'s Card + the `extensions.airi.modules`
 * block, collapsed into a single plain-JSON document.
 */

/** Per-module character configuration (AIRI `extensions.airi.modules`). */
export interface CharacterModules {
  consciousness: {
    provider: string
    model: string
  }
  speech?: {
    provider: string
    model: string
    voiceId: string
    pitch?: number
    rate?: number
    language?: string
  }
  avatar?: {
    kind: 'live2d' | 'vrm'
    source: 'file' | 'url'
    file?: string
    url?: string
  }
}

/** A complete character definition. */
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
  messageExamples?: string[][]
  modules: CharacterModules
}

/** Built-in default character. */
export const DEFAULT_CHARACTER: CharacterCard = {
  name: 'AIRI',
  version: '2.0.0',
  description: 'AIRI is a local-first digital companion — a warm, curious assistant who lives on your machine and helps with anything from quick questions to long-running projects.',
  creator: 'AIRIClaw',
  personality: 'Friendly, upbeat, and concise. Speaks naturally and gets to the point without rambling. Curious about the user\'s world, honest about uncertainty, and never condescending.',
  greetings: [
    'Hey! AIRI here — what are we up to today?',
  ],
  systemPrompt: 'You are AIRI, a helpful digital companion. Keep replies clear and concise, stay in character, and be genuinely useful.',
  modules: {
    consciousness: {
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
    },
  },
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Load a character card from parsed JSON, shallow-merged over
 * {@link DEFAULT_CHARACTER} (with `modules` merged one level deep).
 */
export function loadCharacterCard(json: unknown): CharacterCard {
  if (!isPlainObject(json))
    throw new TypeError(`Character card must be a plain object, got ${json === null ? 'null' : Array.isArray(json) ? 'array' : typeof json}`)

  const input = json as Partial<CharacterCard>

  const card: CharacterCard = {
    ...DEFAULT_CHARACTER,
    ...input,
    modules: {
      ...DEFAULT_CHARACTER.modules,
      ...(isPlainObject(input.modules) ? input.modules : {}),
    },
  }

  if (typeof card.name !== 'string' || card.name.trim() === '')
    throw new Error('Character card is invalid: "name" must be a non-empty string')
  if (typeof card.personality !== 'string' || card.personality.trim() === '')
    throw new Error('Character card is invalid: "personality" must be a non-empty string')

  return card
}
