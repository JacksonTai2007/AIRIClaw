export interface ChannelMessage {
  channelId: string
  channelType: string
  senderId: string
  content: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface ChannelBridgeConfig {
  enabled: boolean
  allowList?: string[]
  denyList?: string[]
}

export type GatewayFrameType = 'req' | 'res' | 'event'

export interface GatewayRequest {
  type: 'req'
  id: string
  method: string
  params?: Record<string, unknown>
}

export interface GatewayResponse {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: string
}

export interface GatewayEvent {
  type: 'event'
  event: string
  payload?: unknown
  seq?: number
  stateVersion?: number
}

export type GatewayFrame = GatewayRequest | GatewayResponse | GatewayEvent

export const GATEWAY_DEFAULTS = {
  PORT: 18789,
  PROTOCOL_VERSION: 4,
  REQUEST_TIMEOUT_MS: 30_000,
  CHALLENGE_TIMEOUT_MS: 15_000,
  MAX_PAYLOAD_BYTES: 25 * 1024 * 1024,
  KEEPALIVE_MS: 30_000,
} as const
