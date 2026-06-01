/**
 * AIRIClaw — a local-first Agent + digital-human assistant.
 *
 * Fuses OpenClaw's agent/skill/gateway runtime with Project AIRI's character
 * and event protocol, powered by DeepSeek V4 Pro.
 *
 * Public API surface. Import sub-namespaces as needed:
 *   import { Assistant, loadConfig, DeepSeekProvider } from 'airiclaw'
 */

export * from './config/index.js'
export * from './llm/index.js'
export * from './agent/index.js'
export * from './skills/index.js'
export * from './character/index.js'
export * from './memory/index.js'
export * from './events/index.js'
export * from './gateway/index.js'
export * from './voice/index.js'
export * from './runtime/index.js'
