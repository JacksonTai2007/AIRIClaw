import type { BridgeModule } from '@airiclaw/core'
import { BridgeEventBus } from '@airiclaw/core'
import type { ChannelBridgeConfig, ChannelMessage } from '@airiclaw/types'
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

  constructor(private readonly options: ChannelBridgeOptions) {}

  async start(): Promise<void> {
    if (!this.options.config.enabled) return
    if (!this.options.gatewayUrl) {
      throw new Error('channel-bridge requires a gatewayUrl to connect')
    }
    this.options.events?.emit('channel:connected', { url: this.options.gatewayUrl })
  }

  async stop(): Promise<void> {
    // v0.1: no persistent connection yet
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
