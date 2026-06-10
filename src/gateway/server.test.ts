import { afterEach, describe, expect, it } from 'vitest'
import { EventBus } from '../events/bus.js'
import { createRequest, type EventFrame, type ResponseFrame } from './frames.js'
import { GatewayServer } from './server.js'

const TIMEOUT = 4000

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), TIMEOUT),
    ),
  ])
}

function openClient(port: number): Promise<WebSocket> {
  return withTimeout(
    new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`)
      ws.addEventListener('open', () => resolve(ws), { once: true })
      ws.addEventListener('error', () => reject(new Error('websocket error')), { once: true })
    }),
    'websocket open',
  )
}

function nextMessage(ws: WebSocket): Promise<unknown> {
  return withTimeout(
    new Promise<unknown>((resolve) => {
      ws.addEventListener(
        'message',
        (event) => resolve(JSON.parse(String((event as MessageEvent).data))),
        { once: true },
      )
    }),
    'websocket message',
  )
}

describe('GatewayServer', () => {
  let server: GatewayServer | null = null
  let client: WebSocket | null = null

  afterEach(async () => {
    client?.close()
    client = null
    await server?.stop()
    server = null
  })

  it('dispatches registered methods and responds with payload', async () => {
    server = new GatewayServer({ port: 0 })
    server.register('ping', () => ({ pong: true }))
    await server.start()

    const port = server.address?.port
    expect(port).toBeTypeOf('number')

    client = await openClient(port!)
    const reply = nextMessage(client)
    client.send(JSON.stringify(createRequest('req-1', 'ping')))

    const res = (await reply) as ResponseFrame
    expect(res).toEqual({ type: 'res', id: 'req-1', ok: true, payload: { pong: true } })
  })

  it('responds with unknown_method error for unregistered methods', async () => {
    server = new GatewayServer({ port: 0 })
    await server.start()

    client = await openClient(server.address!.port)
    const reply = nextMessage(client)
    client.send(JSON.stringify(createRequest('req-2', 'does.not.exist')))

    const res = (await reply) as ResponseFrame
    expect(res.type).toBe('res')
    expect(res.id).toBe('req-2')
    expect(res.ok).toBe(false)
    expect(res.error?.code).toBe('unknown_method')
  })

  it('broadcasts bus events to connected clients as event frames with seq', async () => {
    const bus = new EventBus()
    server = new GatewayServer({ port: 0, bus })
    await server.start()

    client = await openClient(server.address!.port)
    const incoming = nextMessage(client)
    bus.emit('output:gen-ai:chat:delta', { delta: 'x' })

    const frame = (await incoming) as EventFrame
    expect(frame.type).toBe('event')
    expect(frame.event).toBe('output:gen-ai:chat:delta')
    expect(frame.payload).toEqual({ delta: 'x' })
    expect(frame.seq).toBeTypeOf('number')
    expect(frame.seq!).toBeGreaterThan(0)
  })
})
