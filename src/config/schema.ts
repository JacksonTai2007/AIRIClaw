/**
 * Application configuration: `.airiclaw/config.json` overlaid with env vars.
 */

import type { LLMConfig } from '../llm/types.js'
import { DEEPSEEK_DEFAULTS } from '../llm/types.js'

export interface AppConfig {
  /** LLM provider configuration. Defaults to DeepSeek V4 Pro. */
  llm: LLMConfig
  /** Path to a character card JSON file. Optional — falls back to the default persona. */
  characterPath?: string
  /** Directory scanned recursively for SKILL.md skills. */
  skillsDir: string
  /** Base directory for memory files (MEMORY.md, DREAMS.md, daily/). */
  memoryDir: string
  /** Gateway server port (OpenClaw frame protocol v4). */
  gatewayPort: number
  /** Max LLM round-trips per agent run. */
  maxTurns: number
}

export const DEFAULT_CONFIG: AppConfig = {
  llm: {
    provider: 'deepseek',
    model: DEEPSEEK_DEFAULTS.MODEL_PRO,
    baseURL: DEEPSEEK_DEFAULTS.BASE_URL,
    thinkingMode: DEEPSEEK_DEFAULTS.THINKING_MODE,
    temperature: 0.7,
  },
  skillsDir: '.airiclaw/skills',
  memoryDir: '.airiclaw/memory',
  gatewayPort: 18789,
  maxTurns: 12,
}
