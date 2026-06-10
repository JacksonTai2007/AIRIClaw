/**
 * AIRI-style protocol events — the seam where the digital-human layer plugs in.
 *
 * The agent runtime emits `output:gen-ai:chat:*`, `output:emotion`,
 * `output:lipsync`, `output:speech` and `spark:*`; input arrives as
 * `input:text` / `input:voice`. Names and payload shapes mirror AIRI v0.10.2's
 * `plugin-protocol` package so AIRI-compatible frontends can subscribe.
 */

import type { AgentMessage } from '../agent/types.js'
import type { TokenUsage, ToolCall } from '../llm/types.js'

/** Delivery target tag (avatar, voice, a channel id, ...). */
export type Destination = string

export interface InputTextEvent {
  text: string
  sessionId?: string
  /** Source tag, e.g. 'cli' | 'gateway' | 'stage-web'. */
  source?: string
}

export interface InputVoiceEvent {
  /** Raw PCM/encoded audio. */
  audio: ArrayBuffer
  sessionId?: string
  source?: string
}

export interface OutputChatDeltaEvent {
  /** Incremental assistant text for streaming captions / speech. */
  delta: string
  sessionId?: string
}

export interface OutputChatMessageEvent {
  message: AgentMessage
  sessionId?: string
}

export interface OutputChatToolCallEvent {
  call: ToolCall
  sessionId?: string
}

export interface OutputChatCompleteEvent {
  message: AgentMessage
  usage: TokenUsage
  sessionId?: string
}

/** Expression hint for the avatar (Live2D/VRM expression name). */
export interface OutputEmotionEvent {
  emotion: string
  intensity?: number
  sessionId?: string
}

/** Lip-sync mouth-open value (0–1) for avatar mouth animation. */
export interface OutputLipSyncEvent {
  mouthOpen: number
  vowel?: 'A' | 'E' | 'I' | 'O' | 'U'
  sessionId?: string
}

/** Synthesized speech ready for playback. */
export interface OutputSpeechEvent {
  audio: ArrayBuffer
  text: string
  sessionId?: string
}

/** Context injection (memory recall, situational awareness) — AIRI `context:update`. */
export interface ContextUpdateEvent {
  id: string
  contextId: string
  strategy: 'replace-self' | 'append-self'
  text: string
  metadata?: Record<string, unknown>
}

/** Proactive notification from the agent ("spark"). */
export interface SparkNotifyEvent {
  id: string
  kind: 'alarm' | 'ping' | 'reminder'
  urgency: 'immediate' | 'soon' | 'later'
  headline: string
  note?: string
  destinations: Destination[]
}

/** Imperative command toward the agent/character. */
export interface SparkCommandEvent {
  id: string
  intent: 'plan' | 'proposal' | 'action' | 'pause' | 'resume' | 'reroute' | 'context'
  priority: 'critical' | 'high' | 'normal' | 'low'
  interrupt: 'force' | 'soft' | false
  text?: string
  destinations: Destination[]
}

/** Wire event name → payload type, consumed by the typed {@link EventBus}. */
export interface ProtocolEvents {
  'input:text': InputTextEvent
  'input:voice': InputVoiceEvent
  'output:gen-ai:chat:delta': OutputChatDeltaEvent
  'output:gen-ai:chat:message': OutputChatMessageEvent
  'output:gen-ai:chat:tool-call': OutputChatToolCallEvent
  'output:gen-ai:chat:complete': OutputChatCompleteEvent
  'output:emotion': OutputEmotionEvent
  'output:lipsync': OutputLipSyncEvent
  'output:speech': OutputSpeechEvent
  'context:update': ContextUpdateEvent
  'spark:notify': SparkNotifyEvent
  'spark:command': SparkCommandEvent
}

export type ProtocolEventName = keyof ProtocolEvents
