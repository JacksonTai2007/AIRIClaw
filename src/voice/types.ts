/**
 * Digital-human speech abstraction: text-to-speech, speech-to-text, and
 * lip-sync analysis. Concrete providers (cloud TTS, whisper, audio engines)
 * implement these interfaces; the runtime depends only on the abstraction.
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

export interface LipSyncFrame {
  mouthOpen: number
  vowel?: 'A' | 'E' | 'I' | 'O' | 'U'
}

export interface LipSyncDriver {
  readonly id: string
  analyze(audio: ArrayBuffer): LipSyncFrame[]
}
