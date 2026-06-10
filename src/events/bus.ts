/**
 * Typed event bus over the AIRI protocol event map. Zero dependencies;
 * synchronous dispatch with isolated listeners — one bad listener never
 * breaks an emit.
 */

import type { ProtocolEventName, ProtocolEvents } from './types.js'

export type Listener<E extends ProtocolEventName> = (
  payload: ProtocolEvents[E],
) => void | Promise<void>

export type Unsubscribe = () => void

export class EventBus {
  private readonly listeners = new Map<ProtocolEventName, Set<Listener<ProtocolEventName>>>()
  private readonly anyListeners = new Set<(event: ProtocolEventName, payload: unknown) => void>()

  on<E extends ProtocolEventName>(event: E, listener: Listener<E>): Unsubscribe {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(listener as Listener<ProtocolEventName>)
    return () => set.delete(listener as Listener<ProtocolEventName>)
  }

  once<E extends ProtocolEventName>(event: E, listener: Listener<E>): Unsubscribe {
    const off = this.on(event, async (payload) => {
      off()
      await listener(payload)
    })
    return off
  }

  /** Subscribe to every event (logging, gateway fan-out). */
  onAny(listener: (event: ProtocolEventName, payload: unknown) => void): Unsubscribe {
    this.anyListeners.add(listener)
    return () => this.anyListeners.delete(listener)
  }

  emit<E extends ProtocolEventName>(event: E, payload: ProtocolEvents[E]): void {
    const set = this.listeners.get(event)
    if (set) {
      for (const listener of [...set]) {
        try {
          void listener(payload)
        } catch (error) {
          console.error(`[airiclaw] listener for "${event}" threw:`, error)
        }
      }
    }
    for (const listener of [...this.anyListeners]) {
      try {
        listener(event, payload)
      } catch (error) {
        console.error('[airiclaw] onAny listener threw:', error)
      }
    }
  }

  removeAll(event?: ProtocolEventName): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
      this.anyListeners.clear()
    }
  }
}
