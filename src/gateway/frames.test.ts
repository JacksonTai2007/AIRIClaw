import { describe, it, expect } from 'vitest'
import {
  PROTOCOL_VERSION,
  GATEWAY_DEFAULT_PORT,
  createRequest,
  createResponse,
  createErrorResponse,
  createEvent,
  parseFrame,
  isRequest,
  isResponse,
  isEvent,
} from './frames.js'

describe('frame constants', () => {
  it('matches OpenClaw protocol v4 defaults', () => {
    expect(PROTOCOL_VERSION).toBe(4)
    expect(GATEWAY_DEFAULT_PORT).toBe(18789)
  })
})

describe('constructors', () => {
  it('createRequest', () => {
    expect(createRequest('1', 'ping')).toEqual({ type: 'req', id: '1', method: 'ping' })
    expect(createRequest('2', 'echo', { a: 1 })).toEqual({
      type: 'req',
      id: '2',
      method: 'echo',
      params: { a: 1 },
    })
  })

  it('createResponse is ok:true', () => {
    expect(createResponse('1')).toEqual({ type: 'res', id: '1', ok: true })
    expect(createResponse('1', { pong: true })).toEqual({
      type: 'res',
      id: '1',
      ok: true,
      payload: { pong: true },
    })
  })

  it('createErrorResponse is ok:false', () => {
    expect(createErrorResponse('1', 'oops', 'bad', { x: 1 })).toEqual({
      type: 'res',
      id: '1',
      ok: false,
      error: { code: 'oops', message: 'bad', details: { x: 1 } },
    })
  })

  it('createEvent', () => {
    expect(createEvent('output:speech')).toEqual({ type: 'event', event: 'output:speech' })
    expect(createEvent('output:speech', { text: 'hi' }, 3)).toEqual({
      type: 'event',
      event: 'output:speech',
      payload: { text: 'hi' },
      seq: 3,
    })
  })
})

describe('parseFrame', () => {
  it('parses valid req/res/event', () => {
    expect(parseFrame(JSON.stringify(createRequest('1', 'ping')))).toMatchObject({ type: 'req' })
    expect(parseFrame(JSON.stringify(createResponse('1', {})))).toMatchObject({ type: 'res' })
    expect(parseFrame(JSON.stringify(createEvent('e')))).toMatchObject({ type: 'event' })
  })

  it('throws on non-JSON', () => {
    expect(() => parseFrame('not json')).toThrow(/not valid JSON/)
  })

  it('throws on unknown type', () => {
    expect(() => parseFrame(JSON.stringify({ type: 'nope' }))).toThrow(/unknown type/)
  })

  it('throws on missing required fields', () => {
    expect(() => parseFrame(JSON.stringify({ type: 'req', method: 'x' }))).toThrow(/"id"/)
    expect(() => parseFrame(JSON.stringify({ type: 'req', id: '1' }))).toThrow(/"method"/)
    expect(() => parseFrame(JSON.stringify({ type: 'res', id: '1' }))).toThrow(/"ok"/)
    expect(() => parseFrame(JSON.stringify({ type: 'event' }))).toThrow(/"event"/)
  })

  it('throws on non-object JSON', () => {
    expect(() => parseFrame('42')).toThrow(/expected a JSON object/)
  })
})

describe('type guards', () => {
  it('narrow correctly', () => {
    expect(isRequest(createRequest('1', 'x'))).toBe(true)
    expect(isResponse(createResponse('1'))).toBe(true)
    expect(isEvent(createEvent('e'))).toBe(true)
    expect(isRequest(createEvent('e'))).toBe(false)
    expect(isResponse(createRequest('1', 'x'))).toBe(false)
  })
})
