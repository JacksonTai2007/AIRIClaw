import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WebSocket } from 'ws'
import { EventBus } from '../events/index.js'
import { GatewayServer } from './server.js'
import { createRequest, parseFrame, isResponse, isEvent } from './frames.js'

function waitOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve())
    socket.once('error', reject)
  })
}

function nextMessage(socket: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    socket.once('message', (data) => resolve(data.toString()))
    socket.once('error', reject)
  })
}

describe('GatewayServer', () => {
  let bus: EventBus
  let server: GatewayServer
  let client: WebSocket | undefined

  beforeEach(async () => {
    bus = new EventBus()
    server = new GatewayServer({ port: 0, bus })
    server.register('ping', () => ({ pong: true }))
    await server.start()
  })

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close()
    }
    client = undefined
    await server.stop()
  })

  it('responds to a registered request method', async () => {
    const port = server.address
    expect(port).toBeGreaterThan(0)
    client = new WebSocket(`ws://127.0.0.1:${port}`)
    await waitOpen(client)

    const responsePromise = nextMessage(client)
    client.send(JSON.stringify(createRequest('r1', 'ping')))
    const frame = parseFrame(await responsePromise)

    expect(isResponse(frame)).toBe(true)
    if (isResponse(frame)) {
      expect(frame.id).toBe('r1')
      expect(frame.ok).toBe(true)
      expect(frame.payload).toEqual({ pong: true })
    }
  })

  it('returns an error response for unknown methods', async () => {
    client = new WebSocket(`ws://127.0.0.1:${server.address}`)
    await waitOpen(client)

    const responsePromise = nextMessage(client)
    client.send(JSON.stringify(createRequest('r2', 'does-not-exist')))
    const frame = parseFrame(await responsePromise)

    expect(isResponse(frame)).toBe(true)
    if (isResponse(frame)) {
      expect(frame.ok).toBe(false)
      expect(frame.error?.code).toBe('unknown_method')
    }
  })

  it('broadcasts bus events as event frames', async () => {
    client = new WebSocket(`ws://127.0.0.1:${server.address}`)
    await waitOpen(client)

    const eventPromise = nextMessage(client)
    bus.emit('output:speech', { audio: new ArrayBuffer(0), text: 'hi' })
    const frame = parseFrame(await eventPromise)

    expect(isEvent(frame)).toBe(true)
    if (isEvent(frame)) {
      expect(frame.event).toBe('output:speech')
      expect(frame.payload).toMatchObject({ text: 'hi' })
      expect(frame.seq).toBe(0)
    }
  })
})
