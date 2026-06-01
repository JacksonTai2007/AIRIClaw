/**
 * Deterministic placeholder lip-sync driver. Treats the audio as 16-bit PCM,
 * windows the samples into a fixed number of frames, and emits a normalized RMS
 * mouth-open envelope (0..1). This gives the digital-human layer plausible
 * mouth-open values without a real audio-analysis engine.
 */

import type { LipSyncDriver, LipSyncFrame } from './types.js'

const MAX_INT16 = 32768

export class EstimateLipSync implements LipSyncDriver {
  readonly id = 'estimate'

  analyze(audio: ArrayBuffer): LipSyncFrame[] {
    // Int16Array requires an even byte length; clamp to a multiple of 2.
    const usableBytes = audio.byteLength - (audio.byteLength % 2)
    if (usableBytes <= 0) return []

    const samples = new Int16Array(audio, 0, usableBytes / 2)
    const total = samples.length
    if (total === 0) return []

    const windows = Math.min(64, total)
    const windowSize = Math.ceil(total / windows)
    const frames: LipSyncFrame[] = []

    for (let start = 0; start < total; start += windowSize) {
      const end = Math.min(start + windowSize, total)
      let sumSquares = 0
      for (let i = start; i < end; i++) {
        const v = samples[i]! / MAX_INT16
        sumSquares += v * v
      }
      const count = end - start
      const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0
      // RMS is already in 0..1 for normalized samples; clamp for safety.
      const mouthOpen = Math.max(0, Math.min(1, rms))
      frames.push({ mouthOpen })
    }

    return frames
  }
}
