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
