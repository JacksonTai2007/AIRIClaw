import type { MemorySyncConfig } from './memory.js'
import type { ChannelBridgeConfig } from './channel.js'

export interface BridgeConfig {
  openclawSkillsPath: string
  openclawGatewayUrl?: string
  airiServerUrl?: string
  memorySync: MemorySyncConfig
  channels: ChannelBridgeConfig
}

export const BRIDGE_EVENTS = {
  SKILL_LOADED: 'skill:loaded',
  SKILL_EXECUTED: 'skill:executed',
  SKILL_FAILED: 'skill:failed',
  SKILL_ADDED: 'skill:added',
  SKILL_CHANGED: 'skill:changed',
  SKILL_REMOVED: 'skill:removed',
  MEMORY_SYNCED: 'memory:synced',
  CHANNEL_CONNECTED: 'channel:connected',
  CHANNEL_MESSAGE: 'channel:message',
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
