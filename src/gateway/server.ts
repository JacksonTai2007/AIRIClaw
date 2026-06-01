/**
 * WebSocket gateway server. Handles request/response RPC over the frame
 * protocol and fans out EventBus protocol events to every connected client.
 */

import { randomUUID } from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'
import type { EventBus } from '../events/index.js'
import {
  GATEWAY_DEFAULT_PORT,
  createErrorResponse,
  createEvent,
  createResponse,
  isRequest,
  parseFrame,
} from './frames.js'
import type { GatewayFrame } from './frames.js'

export type MethodHandler = (
  params: unknown,
  ctx: { connId: string },
) => Promise<unknown> | unknown

export interface GatewayServerOptions {
  port?: number
  bus?: EventBus
}

export class GatewayServer {
  private readonly port: number
  private readonly bus?: EventBus
  private readonly handlers = new Map<string, MethodHandler>()
  private readonly clients = new Map<string, WebSocket>()
  private wss?: WebSocketServer
  private busUnsubscribe?: () => void
  private seq = 0

  constructor(options: GatewayServerOptions = {}) {
    this.port = options.port ?? GATEWAY_DEFAULT_PORT
    this.bus = options.bus
  }

  register(method: string, handler: MethodHandler): void {
    this.handlers.set(method, handler)
  }

  /** Actual bound port (useful when constructed with port:0). */
  get address(): number | undefined {
    const addr = this.wss?.address()
    if (addr && typeof addr === 'object') return addr.port
    return undefined
  }

  async start(): Promise<void> {
    if (this.wss) return
    const wss = new WebSocketServer({ port: this.port })
    this.wss = wss

    wss.on('connection', (socket) => {
      const connId = randomUUID()
      this.clients.set(connId, socket)

      socket.on('message', (data) => {
        void this.handleMessage(connId, socket, data.toString())
      })

      socket.on('close', () => {
        this.clients.delete(connId)
      })

      socket.on('error', () => {
        this.clients.delete(connId)
      })
    })

    if (this.bus) {
      this.busUnsubscribe = this.bus.onAny((event, payload) => {
        this.broadcast(createEvent(event, payload, this.seq++))
      })
    }

    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => reject(err)
      wss.once('error', onError)
      wss.once('listening', () => {
        wss.off('error', onError)
        resolve()
      })
    })
  }

  private async handleMessage(connId: string, socket: WebSocket, raw: string): Promise<void> {
    let frame: GatewayFrame
    try {
      frame = parseFrame(raw)
    } catch (err) {
      // Best-effort: try to recover an id from the raw payload so the client can
      // correlate the failure; otherwise just close politely.
      const id = extractId(raw)
      if (id) {
        this.send(socket, createErrorResponse(id, 'bad_frame', (err as Error).message))
      } else {
        socket.close(1003, 'invalid frame')
      }
      return
    }

    // The gateway only acts on requests; responses/events from clients are
    // ignored.
    if (!isRequest(frame)) return

    const handler = this.handlers.get(frame.method)
    if (!handler) {
      this.send(
        socket,
        createErrorResponse(frame.id, 'unknown_method', `no handler for method "${frame.method}"`),
      )
      return
    }

    try {
      const payload = await handler(frame.params, { connId })
      this.send(socket, createResponse(frame.id, payload))
    } catch (err) {
      this.send(
        socket,
        createErrorResponse(frame.id, 'handler_error', (err as Error).message ?? 'handler failed'),
      )
    }
  }

  broadcast(frame: GatewayFrame): void {
    const data = JSON.stringify(frame)
    for (const socket of this.clients.values()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data)
      }
    }
  }

  private send(socket: WebSocket, frame: GatewayFrame): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(frame))
    }
  }

  async stop(): Promise<void> {
    this.busUnsubscribe?.()
    this.busUnsubscribe = undefined

    for (const socket of this.clients.values()) {
      try {
        socket.close()
      } catch {
        // ignore
      }
    }
    this.clients.clear()

    const wss = this.wss
    if (!wss) return
    this.wss = undefined
    await new Promise<void>((resolve, reject) => {
      wss.close((err) => (err ? reject(err) : resolve()))
    })
  }
}

function extractId(raw: string): string | undefined {
  try {
    const value = JSON.parse(raw)
    if (value && typeof value === 'object' && typeof value.id === 'string') {
      return value.id
    }
  } catch {
    // ignore
  }
  return undefined
}
