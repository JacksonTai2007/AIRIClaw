import type { MemorySyncConfig } from './memory.js'
import type { ChannelBridgeConfig } from './channel.js'

export interface BridgeConfig {
  openclawSkillsPath: string
  openclawGatewayUrl?: string
  airiServerUrl?: string
  memorySync: MemorySyncConfig
  channels: ChannelBridgeConfig
  llm?: LLMConfig
}

export interface LLMConfig {
  provider: 'deepseek' | 'openai' | string
  model: string
  apiKey?: string
  baseURL?: string
  thinkingMode?: 'non_think' | 'think_high' | 'think_max'
}

export const BRIDGE_EVENTS = {
  SKILL_LOADED: 'skill:loaded',
  SKILL_EXECUTED: 'skill:executed',
  SKILL_FAILED: 'skill:failed',
  SKILL_ADDED: 'skill:added',
  SKILL_CHANGED: 'skill:changed',
  SKILL_REMOVED: 'skill:removed',
  MEMORY_SYNCED: 'memory:synced',
  MEMORY_DREAMED: 'memory:dreamed',
  CHANNEL_CONNECTED: 'channel:connected',
  CHANNEL_MESSAGE: 'channel:message',
  LLM_REQUEST: 'llm:request',
  LLM_RESPONSE: 'llm:response',
  LLM_ERROR: 'llm:error',
  BRIDGE_STARTED: 'bridge:started',
  BRIDGE_STOPPED: 'bridge:stopped',
} as const

export type BridgeEventType = (typeof BRIDGE_EVENTS)[keyof typeof BRIDGE_EVENTS]

export const BRIDGE_EVENT_WILDCARD = '*' as const
export type BridgeEventListener = BridgeEventType | typeof BRIDGE_EVENT_WILDCARD

export interface BridgeEvent<T = unknown> {
  type: BridgeEventType
  payload: T
  timestamp: Date
}
