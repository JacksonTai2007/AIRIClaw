import { EventEmitter } from 'eventemitter3'
import {
  BRIDGE_EVENT_WILDCARD,
  type BridgeEvent,
  type BridgeEventListener,
  type BridgeEventType,
} from '@airiclaw/types'

export class BridgeEventBus {
  private readonly emitter = new EventEmitter()

  emit<T>(type: BridgeEventType, payload: T): void {
    const event: BridgeEvent<T> = { type, payload, timestamp: new Date() }
    this.emitter.emit(type, event)
    if (this.emitter.listenerCount(BRIDGE_EVENT_WILDCARD) > 0) {
      this.emitter.emit(BRIDGE_EVENT_WILDCARD, event)
    }
  }

  on<T>(type: BridgeEventListener, handler: (event: BridgeEvent<T>) => void): () => void {
    this.emitter.on(type, handler as (event: BridgeEvent) => void)
    return () => this.emitter.off(type, handler as (event: BridgeEvent) => void)
  }

  off(type: BridgeEventListener, handler: (event: BridgeEvent) => void): void {
    this.emitter.off(type, handler)
  }

  clear(): void {
    this.emitter.removeAllListeners()
  }
}
