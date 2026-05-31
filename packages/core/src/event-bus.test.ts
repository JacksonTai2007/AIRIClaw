import { describe, it, expect, vi } from 'vitest'
import { BridgeEventBus } from './event-bus.js'
import { BRIDGE_EVENTS } from '@airiclaw/types'

describe('BridgeEventBus', () => {
  it('delivers typed events to specific listeners', () => {
    const bus = new BridgeEventBus()
    const handler = vi.fn()
    bus.on(BRIDGE_EVENTS.SKILL_LOADED, handler)
    bus.emit(BRIDGE_EVENTS.SKILL_LOADED, { count: 3 })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0]).toMatchObject({
      type: 'skill:loaded',
      payload: { count: 3 },
    })
  })

  it('also delivers to wildcard listeners', () => {
    const bus = new BridgeEventBus()
    const wildcard = vi.fn()
    bus.on('*', wildcard)
    bus.emit(BRIDGE_EVENTS.MEMORY_SYNCED, { count: 1 })
    expect(wildcard).toHaveBeenCalledTimes(1)
  })

  it('returns an unsubscribe function', () => {
    const bus = new BridgeEventBus()
    const handler = vi.fn()
    const off = bus.on(BRIDGE_EVENTS.BRIDGE_STARTED, handler)
    off()
    bus.emit(BRIDGE_EVENTS.BRIDGE_STARTED, {})
    expect(handler).not.toHaveBeenCalled()
  })

  it('clear() removes all listeners', () => {
    const bus = new BridgeEventBus()
    const handler = vi.fn()
    bus.on(BRIDGE_EVENTS.SKILL_LOADED, handler)
    bus.clear()
    bus.emit(BRIDGE_EVENTS.SKILL_LOADED, {})
    expect(handler).not.toHaveBeenCalled()
  })

  it('emits LLM events', () => {
    const bus = new BridgeEventBus()
    const handler = vi.fn()
    bus.on(BRIDGE_EVENTS.LLM_RESPONSE, handler)
    bus.emit(BRIDGE_EVENTS.LLM_RESPONSE, { model: 'deepseek-v4-pro', text: 'hello' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].payload).toMatchObject({ model: 'deepseek-v4-pro' })
  })
})
