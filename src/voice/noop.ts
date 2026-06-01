/**
 * Safe no-op TTS/STT providers for headless mode (no audio hardware or cloud
 * credentials required).
 */

import type {
  STTProvider,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
  TTSProvider,
  TranscriptionRequest,
  TranscriptionResult,
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
