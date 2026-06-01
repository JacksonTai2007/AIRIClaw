/**
 * Config loading: merge file config over defaults, then apply env overrides.
 * Env: DEEPSEEK_API_KEY, AIRICLAW_MODEL, AIRICLAW_BASE_URL, AIRICLAW_THINKING_MODE,
 * AIRICLAW_GATEWAY_PORT, AIRICLAW_SKILLS_DIR, AIRICLAW_MEMORY_DIR.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ThinkingMode } from '../llm/types.js'
import { DEFAULT_CONFIG, type AppConfig } from './schema.js'

const THINKING_MODES: ThinkingMode[] = ['non_think', 'think_high', 'think_max']

export async function loadConfig(cwd: string = process.cwd()): Promise<AppConfig> {
  const config: AppConfig = structuredClone(DEFAULT_CONFIG)

  // 1. File config (.airiclaw/config.json), if present.
  const configPath = resolve(cwd, '.airiclaw/config.json')
  try {
    const raw = await readFile(configPath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppConfig> & { llm?: Partial<AppConfig['llm']> }
    Object.assign(config, parsed)
    if (parsed.llm) config.llm = { ...DEFAULT_CONFIG.llm, ...parsed.llm }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`Failed to read ${configPath}: ${(error as Error).message}`)
    }
  }

  // 2. Environment overrides.
  const env = process.env
  if (env.DEEPSEEK_API_KEY) config.llm.apiKey = env.DEEPSEEK_API_KEY
  if (env.AIRICLAW_MODEL) config.llm.model = env.AIRICLAW_MODEL
  if (env.AIRICLAW_BASE_URL) config.llm.baseURL = env.AIRICLAW_BASE_URL
  if (env.AIRICLAW_THINKING_MODE && THINKING_MODES.includes(env.AIRICLAW_THINKING_MODE as ThinkingMode)) {
    config.llm.thinkingMode = env.AIRICLAW_THINKING_MODE as ThinkingMode
  }
  if (env.AIRICLAW_GATEWAY_PORT) {
    const port = Number(env.AIRICLAW_GATEWAY_PORT)
    if (Number.isFinite(port)) config.gatewayPort = port
  }
  if (env.AIRICLAW_SKILLS_DIR) config.skillsDir = env.AIRICLAW_SKILLS_DIR
  if (env.AIRICLAW_MEMORY_DIR) config.memoryDir = env.AIRICLAW_MEMORY_DIR

  // Resolve relative paths against cwd.
  config.skillsDir = resolve(cwd, config.skillsDir)
  config.memoryDir = resolve(cwd, config.memoryDir)
  if (config.characterPath) config.characterPath = resolve(cwd, config.characterPath)

  return config
}

export function configTemplate(): string {
  return JSON.stringify(
    {
      llm: {
        provider: 'deepseek',
        model: DEFAULT_CONFIG.llm.model,
        baseURL: DEFAULT_CONFIG.llm.baseURL,
        thinkingMode: DEFAULT_CONFIG.llm.thinkingMode,
        temperature: 0.7,
      },
      skillsDir: '.airiclaw/skills',
      memoryDir: '.airiclaw/memory',
      gatewayPort: 18789,
      maxTurns: 12,
    },
    null,
    2,
  )
}
