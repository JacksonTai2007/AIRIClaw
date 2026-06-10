import { describe, expect, it } from 'vitest'
import { EstimateLipSync } from './estimate-lipsync.js'
import { NoopSTT, NoopTTS } from './noop.js'

function pcmBuffer(samples: number[]): ArrayBuffer {
  return Int16Array.from(samples).buffer
}

describe('EstimateLipSync', () => {
  const driver = new EstimateLipSync()

  it('has id "estimate"', () => {
    expect(driver.id).toBe('estimate')
  })

  it('returns [] for an empty or sub-sample buffer', () => {
    expect(driver.analyze(new ArrayBuffer(0))).toEqual([])
    expect(driver.analyze(new ArrayBuffer(1))).toEqual([])
  })

  it('keeps every mouthOpen value within [0, 1]', () => {
    const samples = Array.from({ length: 1024 }, (_, i) =>
      i % 2 === 0 ? 32767 : -32768,
    )
    const frames = driver.analyze(pcmBuffer(samples))
    expect(frames.length).toBeGreaterThan(0)
    expect(frames.length).toBeLessThanOrEqual(64)
    for (const frame of frames) {
      expect(frame.mouthOpen).toBeGreaterThanOrEqual(0)
      expect(frame.mouthOpen).toBeLessThanOrEqual(1)
    }
  })

  it('gives louder windows a larger mouthOpen than quiet ones', () => {
    // First half quiet, second half loud; window count = 64 over 1280 samples.
    const quiet = Array.from({ length: 640 }, () => 100)
    const loud = Array.from({ length: 640 }, () => 20000)
    const frames = driver.analyze(pcmBuffer([...quiet, ...loud]))
    expect(frames).toHaveLength(64)
    const firstFrame = frames[0]!
    const lastFrame = frames[frames.length - 1]!
    expect(lastFrame.mouthOpen).toBeGreaterThan(firstFrame.mouthOpen)
  })

  it('silence produces mouthOpen 0', () => {
    const frames = driver.analyze(pcmBuffer(new Array(256).fill(0)))
    for (const frame of frames) {
      expect(frame.mouthOpen).toBe(0)
    }
  })

  it('handles an odd trailing byte by truncating it', () => {
    const buffer = new ArrayBuffer(5) // two full samples + one dangling byte
    new Uint8Array(buffer).set([0x00, 0x40, 0x00, 0x40, 0xff])
    const frames = driver.analyze(buffer)
    expect(frames).toHaveLength(2)
    for (const frame of frames) {
      expect(frame.mouthOpen).toBeGreaterThan(0)
      expect(frame.mouthOpen).toBeLessThanOrEqual(1)
    }
  })

  it('is deterministic for identical input', () => {
    const buffer = pcmBuffer(Array.from({ length: 200 }, (_, i) => (i * 997) % 20000))
    expect(driver.analyze(buffer)).toEqual(driver.analyze(buffer))
  })
})

describe('Noop providers', () => {
  it('NoopTTS returns empty wav audio', async () => {
    const tts = new NoopTTS()
    expect(tts.id).toBe('noop')
    const result = await tts.synthesize({ text: 'hello' })
    expect(result.audio.byteLength).toBe(0)
    expect(result.mimeType).toBe('audio/wav')
  })

  it('NoopSTT returns empty transcript', async () => {
    const stt = new NoopSTT()
    expect(stt.id).toBe('noop')
    const result = await stt.transcribe({ audio: new ArrayBuffer(8) })
    expect(result).toEqual({ text: '' })
  })
})
