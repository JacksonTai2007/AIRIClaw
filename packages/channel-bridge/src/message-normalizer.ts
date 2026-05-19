import type { ChannelMessage } from '@airiclaw/types'

export interface NormalizedSparkEvent {
  event: 'spark:command' | 'spark:notify'
  channelId: string
  channelType: string
  senderId: string
  content: string
  metadata: Record<string, unknown>
  timestamp: string
}

export class MessageNormalizer {
  toSparkEvent(message: ChannelMessage): NormalizedSparkEvent {
    return {
      event: 'spark:command',
      channelId: message.channelId,
      channelType: message.channelType,
      senderId: message.senderId,
      content: message.content,
      metadata: message.metadata ?? {},
      timestamp: message.timestamp.toISOString(),
    }
  }
}
