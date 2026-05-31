import type { ChannelMessage, AiriProtocolEvents } from '@airiclaw/types'

export type NormalizedSparkEvent = AiriProtocolEvents['spark:command'] & {
  channelId: string
  channelType: string
  senderId: string
  timestamp: string
}

export class MessageNormalizer {
  toSparkCommand(message: ChannelMessage): NormalizedSparkEvent {
    return {
      command: message.content,
      channelId: message.channelId,
      channelType: message.channelType,
      senderId: message.senderId,
      timestamp: message.timestamp.toISOString(),
    }
  }

  toInputText(message: ChannelMessage): AiriProtocolEvents['input:text'] {
    return {
      text: message.content,
      sessionId: message.channelId,
    }
  }
}
