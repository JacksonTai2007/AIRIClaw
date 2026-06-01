import { describe, it, expect } from 'vitest'
import { EstimateLipSync } from './estimate-lipsync.js'
import { NoopTTS, NoopSTT } from './noop.js'

describe('EstimateLipSync', () => {
  it('has id "estimate"', () => {
    expect(new EstimateLipSync().id).toBe('estimate')
  })

  it('returns frames with mouthOpen in [0,1]', () => {
    const samples = new Int16Array(2000)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.round(Math.sin(i / 5) * 30000)
    }
    const frames = new EstimateLipSync().analyze(samples.buffer)
    expect(frames.length).toBeGreaterThan(0)
    expect(frames.length).toBeLessThanOrEqual(64)
    for (const f of frames) {
      expect(f.mouthOpen).toBeGreaterThanOrEqual(0)
      expect(f.mouthOpen).toBeLessThanOrEqual(1)
    }
  })

  it('is deterministic', () => {
    const samples = new Int16Array([1000, -2000, 3000, -4000, 5000, -6000])
    const driver = new EstimateLipSync()
    expect(driver.analyze(samples.buffer)).toEqual(driver.analyze(samples.buffer))
  })

  it('returns [] for empty audio', () => {
    expect(new EstimateLipSync().analyze(new ArrayBuffer(0))).toEqual([])
  })

  it('louder audio yields larger mouthOpen than quiet audio', () => {
    const loud = new Int16Array(64).fill(30000)
    const quiet = new Int16Array(64).fill(100)
    const driver = new EstimateLipSync()
    expect(driver.analyze(loud.buffer)[0]!.mouthOpen).toBeGreaterThan(
      driver.analyze(quiet.buffer)[0]!.mouthOpen,
    )
  })
})

describe('Noop providers', () => {
  it('NoopTTS returns empty wav audio', async () => {
    const tts = new NoopTTS()
    expect(tts.id).toBe('noop')
    const res = await tts.synthesize({ text: 'hello' })
    expect(res.audio.byteLength).toBe(0)
    expect(res.mimeType).toBe('audio/wav')
  })

  it('NoopSTT returns empty text', async () => {
    const stt = new NoopSTT()
    expect(stt.id).toBe('noop')
    const res = await stt.transcribe({ audio: new ArrayBuffer(0) })
    expect(res.text).toBe('')
  })
})
