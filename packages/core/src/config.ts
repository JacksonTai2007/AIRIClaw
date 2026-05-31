import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { DEEPSEEK_DEFAULTS, type BridgeConfig } from '@airiclaw/types'

const DEFAULT_SKILLS_PATH = join(homedir(), '.openclaw', 'workspace', 'skills')
const DEFAULT_MEMORY_MD = join(homedir(), '.openclaw', 'workspace', 'MEMORY.md')
const DEFAULT_DAILY_NOTES = join(homedir(), '.openclaw', 'workspace', 'memory')
const DEFAULT_DREAMS_MD = join(homedir(), '.openclaw', 'workspace', 'DREAMS.md')

export function defineConfig(config: Partial<BridgeConfig>): BridgeConfig {
  return withDefaults(config)
}

export function withDefaults(partial: Partial<BridgeConfig> = {}): BridgeConfig {
  return {
    openclawSkillsPath: partial.openclawSkillsPath ?? DEFAULT_SKILLS_PATH,
    openclawGatewayUrl: partial.openclawGatewayUrl,
    airiServerUrl: partial.airiServerUrl,
    memorySync: {
      enabled: partial.memorySync?.enabled ?? false,
      memoryMdPath: partial.memorySync?.memoryMdPath ?? DEFAULT_MEMORY_MD,
      dailyNotesDir: partial.memorySync?.dailyNotesDir ?? DEFAULT_DAILY_NOTES,
      dreamsMdPath: partial.memorySync?.dreamsMdPath ?? DEFAULT_DREAMS_MD,
      syncIntervalMs: partial.memorySync?.syncIntervalMs ?? 60_000,
    },
    channels: {
      enabled: partial.channels?.enabled ?? false,
      allowList: partial.channels?.allowList,
      denyList: partial.channels?.denyList,
    },
    llm: partial.llm ?? {
      provider: 'deepseek',
      model: DEEPSEEK_DEFAULTS.MODEL_PRO,
      baseURL: DEEPSEEK_DEFAULTS.BASE_URL,
      thinkingMode: 'think_high',
    },
  }
}

export async function loadConfigFromFile(cwd: string = process.cwd()): Promise<BridgeConfig> {
  const candidates = [
    resolve(cwd, 'airiclaw.config.json'),
    resolve(cwd, '.airiclawrc.json'),
  ]
  for (const path of candidates) {
    if (existsSync(path)) {
      const raw = await readFile(path, 'utf8')
      const parsed = JSON.parse(raw) as Partial<BridgeConfig>
      return withDefaults(applyEnvOverrides(parsed))
    }
  }
  return withDefaults(applyEnvOverrides({}))
}

function applyEnvOverrides(config: Partial<BridgeConfig>): Partial<BridgeConfig> {
  const skillsPath = process.env.AIRICLAW_SKILLS_PATH
  const gatewayUrl = process.env.AIRICLAW_GATEWAY_URL
  const airiUrl = process.env.AIRICLAW_AIRI_URL
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  return {
    ...config,
    ...(skillsPath ? { openclawSkillsPath: skillsPath } : {}),
    ...(gatewayUrl ? { openclawGatewayUrl: gatewayUrl } : {}),
    ...(airiUrl ? { airiServerUrl: airiUrl } : {}),
    ...(deepseekKey ? { llm: { ...config.llm, provider: 'deepseek', model: DEEPSEEK_DEFAULTS.MODEL_PRO, apiKey: deepseekKey } } : {}),
  }
}
