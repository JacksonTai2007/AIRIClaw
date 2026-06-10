/**
 * Deterministic, dependency-free lip-sync estimation: treats the audio buffer
 * as 16-bit PCM samples and derives a mouth-open envelope from per-window RMS.
 */

import type { LipSyncDriver, LipSyncFrame } from './types.js'

const MAX_WINDOWS = 64
const INT16_FULL_SCALE = 32768

export class EstimateLipSync implements LipSyncDriver {
  readonly id = 'estimate'

  analyze(audio: ArrayBuffer): LipSyncFrame[] {
    if (audio.byteLength < 2) return []

    // Truncate any odd trailing byte so the Int16 view is always valid.
    const sampleCount = Math.floor(audio.byteLength / 2)
    const samples = new Int16Array(audio, 0, sampleCount)

    const windowCount = Math.min(MAX_WINDOWS, sampleCount)
    const frames: LipSyncFrame[] = []

    for (let w = 0; w < windowCount; w++) {
      const start = Math.floor((w * sampleCount) / windowCount)
      const end = Math.floor(((w + 1) * sampleCount) / windowCount)
      let sumSquares = 0
      for (let i = start; i < end; i++) {
        const sample = samples[i] ?? 0
        sumSquares += sample * sample
      }
      const size = end - start
      const rms = size > 0 ? Math.sqrt(sumSquares / size) : 0
      const mouthOpen = Math.min(1, Math.max(0, rms / INT16_FULL_SCALE))
      frames.push({ mouthOpen })
    }

    return frames
  }
}
