import { describe, expect, it } from 'vitest'
import {
  GATEWAY_DEFAULT_PORT,
  PROTOCOL_VERSION,
  createErrorResponse,
  createEvent,
  createRequest,
  createResponse,
  isEvent,
  isRequest,
  isResponse,
  parseFrame,
} from './frames.js'

describe('constants', () => {
  it('matches the OpenClaw protocol version and default port', () => {
    expect(PROTOCOL_VERSION).toBe(4)
    expect(GATEWAY_DEFAULT_PORT).toBe(18789)
  })
})

describe('frame creators', () => {
  it('createRequest builds a req frame', () => {
    expect(createRequest('r1', 'ping', { a: 1 })).toEqual({
      type: 'req',
      id: 'r1',
      method: 'ping',
      params: { a: 1 },
    })
    expect(createRequest('r2', 'ping')).toEqual({ type: 'req', id: 'r2', method: 'ping' })
  })

  it('createResponse builds an ok res frame', () => {
    expect(createResponse('r1', { pong: true })).toEqual({
      type: 'res',
      id: 'r1',
      ok: true,
      payload: { pong: true },
    })
    expect(createResponse('r2')).toEqual({ type: 'res', id: 'r2', ok: true })
  })

  it('createErrorResponse builds a not-ok res frame with error shape', () => {
    expect(createErrorResponse('r1', 'unknown_method', 'no such method', { method: 'x' })).toEqual(
      {
        type: 'res',
        id: 'r1',
        ok: false,
        error: { code: 'unknown_method', message: 'no such method', details: { method: 'x' } },
      },
    )
    expect(createErrorResponse('r2', 'bad_frame', 'oops')).toEqual({
      type: 'res',
      id: 'r2',
      ok: false,
      error: { code: 'bad_frame', message: 'oops' },
    })
  })

  it('createEvent builds an event frame', () => {
    expect(createEvent('output:emotion', { emotion: 'joy' }, 7)).toEqual({
      type: 'event',
      event: 'output:emotion',
      payload: { emotion: 'joy' },
      seq: 7,
    })
    expect(createEvent('tick')).toEqual({ type: 'event', event: 'tick' })
  })
})

describe('parseFrame', () => {
  it('parses a valid req frame', () => {
    const frame = parseFrame(JSON.stringify({ type: 'req', id: '1', method: 'ping' }))
    expect(frame).toEqual({ type: 'req', id: '1', method: 'ping' })
  })

  it('parses a valid res frame', () => {
    const frame = parseFrame(JSON.stringify({ type: 'res', id: '1', ok: true, payload: 42 }))
    expect(frame).toEqual({ type: 'res', id: '1', ok: true, payload: 42 })
  })

  it('parses a valid event frame', () => {
    const frame = parseFrame(JSON.stringify({ type: 'event', event: 'tick', seq: 3 }))
    expect(frame).toEqual({ type: 'event', event: 'tick', seq: 3 })
  })

  it('throws on invalid JSON', () => {
    expect(() => parseFrame('{nope')).toThrow(/not valid JSON/)
  })

  it('throws on non-object values', () => {
    expect(() => parseFrame('"hello"')).toThrow(/must be a JSON object/)
    expect(() => parseFrame('null')).toThrow(/must be a JSON object/)
    expect(() => parseFrame('[1,2]')).toThrow(/must be a JSON object/)
  })

  it('throws on unknown frame type', () => {
    expect(() => parseFrame(JSON.stringify({ type: 'nope' }))).toThrow(/unknown gateway frame type/)
    expect(() => parseFrame(JSON.stringify({ hello: true }))).toThrow(/unknown gateway frame type/)
  })

  it('throws on req frames missing id or method', () => {
    expect(() => parseFrame(JSON.stringify({ type: 'req', method: 'ping' }))).toThrow(/"id"/)
    expect(() => parseFrame(JSON.stringify({ type: 'req', id: '', method: 'ping' }))).toThrow(
      /"id"/,
    )
    expect(() => parseFrame(JSON.stringify({ type: 'req', id: '1' }))).toThrow(/"method"/)
    expect(() => parseFrame(JSON.stringify({ type: 'req', id: '1', method: 7 }))).toThrow(
      /"method"/,
    )
  })

  it('throws on res frames missing id or ok', () => {
    expect(() => parseFrame(JSON.stringify({ type: 'res', ok: true }))).toThrow(/"id"/)
    expect(() => parseFrame(JSON.stringify({ type: 'res', id: '1' }))).toThrow(/"ok"/)
    expect(() => parseFrame(JSON.stringify({ type: 'res', id: '1', ok: 'yes' }))).toThrow(/"ok"/)
  })

  it('throws on event frames missing event name', () => {
    expect(() => parseFrame(JSON.stringify({ type: 'event' }))).toThrow(/"event"/)
    expect(() => parseFrame(JSON.stringify({ type: 'event', event: '' }))).toThrow(/"event"/)
  })
})

describe('type guards', () => {
  const req = createRequest('1', 'ping')
  const res = createResponse('1')
  const evt = createEvent('tick')

  it('isRequest', () => {
    expect(isRequest(req)).toBe(true)
    expect(isRequest(res)).toBe(false)
    expect(isRequest(evt)).toBe(false)
  })

  it('isResponse', () => {
    expect(isResponse(res)).toBe(true)
    expect(isResponse(req)).toBe(false)
    expect(isResponse(evt)).toBe(false)
  })

  it('isEvent', () => {
    expect(isEvent(evt)).toBe(true)
    expect(isEvent(req)).toBe(false)
    expect(isEvent(res)).toBe(false)
  })
})
