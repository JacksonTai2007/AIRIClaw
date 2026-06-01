/**
 * Hand-written mirror of the OpenClaw gateway frame protocol (v4). No TypeBox —
 * plain TypeScript types plus small constructor/parser/guard helpers so the
 * gateway server and any client can speak the same wire format.
 */

export const PROTOCOL_VERSION = 4 as const
export const GATEWAY_DEFAULT_PORT = 18789 as const

export interface RequestFrame {
  type: 'req'
  id: string
  method: string
  params?: unknown
}

export interface ResponseFrame {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: {
    code: string
    message: string
    details?: unknown
    retryable?: boolean
  }
}

export interface EventFrame {
  type: 'event'
  event: string
  payload?: unknown
  seq?: number
  stateVersion?: number
}

export type GatewayFrame = RequestFrame | ResponseFrame | EventFrame

export function createRequest(id: string, method: string, params?: unknown): RequestFrame {
  const frame: RequestFrame = { type: 'req', id, method }
  if (params !== undefined) frame.params = params
  return frame
}

export function createResponse(id: string, payload?: unknown): ResponseFrame {
  const frame: ResponseFrame = { type: 'res', id, ok: true }
  if (payload !== undefined) frame.payload = payload
  return frame
}

export function createErrorResponse(
  id: string,
  code: string,
  message: string,
  details?: unknown,
): ResponseFrame {
  const error: ResponseFrame['error'] = { code, message }
  if (details !== undefined) error.details = details
  return { type: 'res', id, ok: false, error }
}

export function createEvent(event: string, payload?: unknown, seq?: number): EventFrame {
  const frame: EventFrame = { type: 'event', event }
  if (payload !== undefined) frame.payload = payload
  if (seq !== undefined) frame.seq = seq
  return frame
}

/**
 * Parse a raw JSON string into a {@link GatewayFrame}, validating the
 * discriminator and required fields. Throws an Error with a clear message on
 * malformed input.
 */
export function parseFrame(raw: string): GatewayFrame {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (err) {
    throw new Error(`invalid frame: not valid JSON (${(err as Error).message})`)
  }

  if (typeof value !== 'object' || value === null) {
    throw new Error('invalid frame: expected a JSON object')
  }

  const obj = value as Record<string, unknown>
  const type = obj.type

  switch (type) {
    case 'req': {
      if (typeof obj.id !== 'string' || obj.id.length === 0) {
        throw new Error('invalid req frame: missing string "id"')
      }
      if (typeof obj.method !== 'string' || obj.method.length === 0) {
        throw new Error('invalid req frame: missing string "method"')
      }
      return obj as unknown as RequestFrame
    }
    case 'res': {
      if (typeof obj.id !== 'string' || obj.id.length === 0) {
        throw new Error('invalid res frame: missing string "id"')
      }
      if (typeof obj.ok !== 'boolean') {
        throw new Error('invalid res frame: missing boolean "ok"')
      }
      return obj as unknown as ResponseFrame
    }
    case 'event': {
      if (typeof obj.event !== 'string' || obj.event.length === 0) {
        throw new Error('invalid event frame: missing string "event"')
      }
      return obj as unknown as EventFrame
    }
    default:
      throw new Error(
        `invalid frame: unknown type ${JSON.stringify(type)} (expected "req" | "res" | "event")`,
      )
  }
}

export function isRequest(frame: GatewayFrame): frame is RequestFrame {
  return frame.type === 'req'
}

export function isResponse(frame: GatewayFrame): frame is ResponseFrame {
  return frame.type === 'res'
}

export function isEvent(frame: GatewayFrame): frame is EventFrame {
  return frame.type === 'event'
}
