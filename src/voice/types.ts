/**
 * Voice abstraction for the digital-human layer: text-to-speech,
 * speech-to-text, and lip-sync analysis. Implementations may be headless
 * (no-op) or wired to real engines; consumers depend only on these contracts.
 */

export interface SpeechSynthesisRequest {
  text: string
  voiceId?: string
  pitch?: number
  rate?: number
  language?: string
}

export interface SpeechSynthesisResult {
  audio: ArrayBuffer
  mimeType: string
  durationMs?: number
}

export interface TTSProvider {
  readonly id: string
  synthesize(req: SpeechSynthesisRequest): Promise<SpeechSynthesisResult>
}

export interface TranscriptionRequest {
  audio: ArrayBuffer
  language?: string
}

export interface TranscriptionResult {
  text: string
  language?: string
}

export interface STTProvider {
  readonly id: string
  transcribe(req: TranscriptionRequest): Promise<TranscriptionResult>
}

/** One frame of mouth animation; `mouthOpen` is normalized to [0, 1]. */
export interface LipSyncFrame {
  mouthOpen: number
  vowel?: 'A' | 'E' | 'I' | 'O' | 'U'
}

export interface LipSyncDriver {
  readonly id: string
  analyze(audio: ArrayBuffer): LipSyncFrame[]
}
