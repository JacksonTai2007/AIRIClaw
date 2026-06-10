/**
 * Minimal OpenClaw-style gateway server: a WebSocket endpoint that dispatches
 * `req` frames to registered method handlers and (optionally) fans out
 * {@link EventBus} events to every connected client as `event` frames.
 */

import { randomUUID } from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'
import type { EventBus, Unsubscribe } from '../events/bus.js'
import {
  GATEWAY_DEFAULT_PORT,
  createErrorResponse,
  createEvent,
  createResponse,
  isRequest,
  parseFrame,
  type GatewayFrame,
} from './frames.js'

export type MethodHandler = (
  params: unknown,
  ctx: { connId: string },
) => Promise<unknown> | unknown

export interface GatewayServerOptions {
  port?: number
  bus?: EventBus
}

export class GatewayServer {
  private readonly options: GatewayServerOptions
  private readonly handlers = new Map<string, MethodHandler>()
  private wss: WebSocketServer | null = null
  private busUnsubscribe: Unsubscribe | null = null
  private seq = 0

  constructor(options: GatewayServerOptions = {}) {
    this.options = options
  }

  register(method: string, handler: MethodHandler): void {
    this.handlers.set(method, handler)
  }

  /** Actual bound address (available after {@link start} resolves). */
  get address(): { port: number } | null {
    const addr = this.wss?.address()
    if (!addr || typeof addr === 'string') return null
    return { port: addr.port }
  }

  start(): Promise<void> {
    if (this.wss) return Promise.resolve()

    return new Promise<void>((resolve, reject) => {
      const wss = new WebSocketServer({ port: this.options.port ?? GATEWAY_DEFAULT_PORT })
      this.wss = wss

      wss.once('error', reject)
      wss.once('listening', () => {
        wss.removeListener('error', reject)
        resolve()
      })

      wss.on('connection', (socket) => {
        const connId = randomUUID()
        socket.on('message', (data) => {
          void this.handleMessage(socket, connId, data.toString())
        })
      })

      if (this.options.bus) {
        this.busUnsubscribe = this.options.bus.onAny((event, payload) => {
          this.broadcast(createEvent(event, payload, ++this.seq))
        })
      }
    })
  }

  private async handleMessage(socket: WebSocket, connId: string, raw: string): Promise<void> {
    let frame: GatewayFrame
    try {
      frame = parseFrame(raw)
    } catch (error) {
      this.send(
        socket,
        createErrorResponse(
          'unknown',
          'bad_frame',
          error instanceof Error ? error.message : String(error),
        ),
      )
      return
    }

    // Clients only issue requests; ignore stray res/event frames.
    if (!isRequest(frame)) return

    const handler = this.handlers.get(frame.method)
    if (!handler) {
      this.send(
        socket,
        createErrorResponse(frame.id, 'unknown_method', `unknown method: ${frame.method}`),
      )
      return
    }

    try {
      const result = await handler(frame.params, { connId })
      this.send(socket, createResponse(frame.id, result))
    } catch (error) {
      this.send(
        socket,
        createErrorResponse(
          frame.id,
          'handler_error',
          error instanceof Error ? error.message : String(error),
        ),
      )
    }
  }

  private send(socket: WebSocket, frame: GatewayFrame): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(frame))
    }
  }

  broadcast(frame: GatewayFrame): void {
    if (!this.wss) return
    const data = JSON.stringify(frame)
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    }
  }

  stop(): Promise<void> {
    this.busUnsubscribe?.()
    this.busUnsubscribe = null

    const wss = this.wss
    this.wss = null
    if (!wss) return Promise.resolve()

    for (const client of wss.clients) {
      client.terminate()
    }
    return new Promise<void>((resolve, reject) => {
      wss.close((error) => (error ? reject(error) : resolve()))
    })
  }
}
