/**
 * Headless voice providers — useful defaults when no real TTS/STT engine is
 * configured (CI, server-only deployments, tests).
 */

import type {
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
  STTProvider,
  TranscriptionRequest,
  TranscriptionResult,
  TTSProvider,
} from './types.js'

export class NoopTTS implements TTSProvider {
  readonly id = 'noop'

  async synthesize(_req: SpeechSynthesisRequest): Promise<SpeechSynthesisResult> {
    return { audio: new ArrayBuffer(0), mimeType: 'audio/wav' }
  }
}

export class NoopSTT implements STTProvider {
  readonly id = 'noop'

  async transcribe(_req: TranscriptionRequest): Promise<TranscriptionResult> {
    return { text: '' }
  }
}
