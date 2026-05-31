import type { BridgeModule } from '@airiclaw/core'
import { BridgeEventBus } from '@airiclaw/core'
import {
  GATEWAY_DEFAULTS,
  type ChannelBridgeConfig,
  type ChannelMessage,
  type GatewayRequest,
  type GatewayFrame,
} from '@airiclaw/types'
import { MessageNormalizer } from './message-normalizer.js'

export interface ChannelBridgeOptions {
  gatewayUrl?: string
  config: ChannelBridgeConfig
  events?: BridgeEventBus
  onMessage?: (message: ChannelMessage) => void | Promise<void>
}

export class ChannelBridge implements BridgeModule {
  readonly name = 'channel-bridge'
  readonly normalizer = new MessageNormalizer()
  private requestId = 0

  constructor(private readonly options: ChannelBridgeOptions) {}

  async start(): Promise<void> {
    if (!this.options.config.enabled) return
    if (!this.options.gatewayUrl) {
      throw new Error('channel-bridge requires a gatewayUrl to connect')
    }
    this.options.events?.emit('channel:connected', {
      url: this.options.gatewayUrl,
      protocolVersion: GATEWAY_DEFAULTS.PROTOCOL_VERSION,
    })
  }

  async stop(): Promise<void> {
    this.requestId = 0
  }

  createRequest(method: string, params?: Record<string, unknown>): GatewayRequest {
    return {
      type: 'req',
      id: `req_${++this.requestId}`,
      method,
      params,
    }
  }

  parseFrame(raw: string): GatewayFrame {
    const frame = JSON.parse(raw) as GatewayFrame
    if (!frame.type || !['req', 'res', 'event'].includes(frame.type)) {
      throw new Error(`Invalid gateway frame type: ${(frame as unknown as Record<string, unknown>).type}`)
    }
    return frame
  }

  ingest(message: ChannelMessage): void {
    if (!this.isAllowed(message.channelType)) return
    this.options.events?.emit('channel:message', message)
    void this.options.onMessage?.(message)
  }

  private isAllowed(channelType: string): boolean {
    const { allowList, denyList } = this.options.config
    if (denyList?.includes(channelType)) return false
    if (allowList && !allowList.includes(channelType)) return false
    return true
  }
}
