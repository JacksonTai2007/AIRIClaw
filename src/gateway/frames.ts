/**
 * Gateway wire protocol frames — plain-TypeScript mirror of OpenClaw's
 * `gateway-protocol` envelope schemas (req / res / event over WebSocket).
 */

/** Current gateway protocol version emitted by modern clients and servers. */
export const PROTOCOL_VERSION = 4 as const

/** Default TCP port the gateway WebSocket server listens on. */
export const GATEWAY_DEFAULT_PORT = 18789 as const

/** Client request frame envelope; `method` selects the handler. */
export interface RequestFrame {
  type: 'req'
  id: string
  method: string
  params?: unknown
}

/** Standard structured error shape used in response frames. */
export interface ResponseError {
  code: string
  message: string
  details?: unknown
  retryable?: boolean
}

/** Server response frame envelope paired with a prior request id. */
export interface ResponseFrame {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: ResponseError
}

/** Server event frame envelope; `event` names the broadcast channel. */
export interface EventFrame {
  type: 'event'
  event: string
  payload?: unknown
  seq?: number
  stateVersion?: number
}

/** Discriminated union of all top-level gateway frames. */
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
  const error: ResponseError = { code, message }
  if (details !== undefined) error.details = details
  return { type: 'res', id, ok: false, error }
}

export function createEvent(event: string, payload?: unknown, seq?: number): EventFrame {
  const frame: EventFrame = { type: 'event', event }
  if (payload !== undefined) frame.payload = payload
  if (seq !== undefined) frame.seq = seq
  return frame
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * Parse and validate a raw wire string into a {@link GatewayFrame}.
 * Throws an `Error` with a descriptive message on any malformed input.
 */
export function parseFrame(raw: string): GatewayFrame {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `gateway frame is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('gateway frame must be a JSON object')
  }

  const frame = parsed as Record<string, unknown>

  switch (frame.type) {
    case 'req': {
      if (!isNonEmptyString(frame.id)) {
        throw new Error('req frame requires a non-empty string "id"')
      }
      if (!isNonEmptyString(frame.method)) {
        throw new Error('req frame requires a non-empty string "method"')
      }
      return frame as unknown as RequestFrame
    }
    case 'res': {
      if (!isNonEmptyString(frame.id)) {
        throw new Error('res frame requires a non-empty string "id"')
      }
      if (typeof frame.ok !== 'boolean') {
        throw new Error('res frame requires a boolean "ok"')
      }
      return frame as unknown as ResponseFrame
    }
    case 'event': {
      if (!isNonEmptyString(frame.event)) {
        throw new Error('event frame requires a non-empty string "event"')
      }
      return frame as unknown as EventFrame
    }
    default:
      throw new Error(`unknown gateway frame type: ${JSON.stringify(frame.type)}`)
  }
}
