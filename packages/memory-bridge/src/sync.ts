import { createHash } from 'node:crypto'
import type { BridgeModule, BridgeEventBus } from '@airiclaw/core'
import { BRIDGE_EVENTS, type MemoryEntry, type MemorySyncConfig } from '@airiclaw/types'
import { MarkdownMemoryReader } from './markdown-reader.js'

export interface MemoryBridgeOptions {
  config: MemorySyncConfig
  events?: BridgeEventBus
  onEntries?: (entries: MemoryEntry[]) => void | Promise<void>
}

export class MemoryBridge implements BridgeModule {
  readonly name = 'memory-bridge'
  readonly reader = new MarkdownMemoryReader()
  private timer?: NodeJS.Timeout
  private lastDigest: string | null = null

  constructor(private readonly options: MemoryBridgeOptions) {}

  async start(): Promise<void> {
    if (!this.options.config.enabled) return
    await this.syncOnce()
    const interval = this.options.config.syncIntervalMs ?? 60_000
    this.timer = setInterval(() => { void this.syncOnce() }, interval)
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    this.lastDigest = null
  }

  async syncOnce(): Promise<MemoryEntry[]> {
    const { memoryMdPath, dailyNotesDir } = this.options.config
    const entries: MemoryEntry[] = []
    if (memoryMdPath) {
      entries.push(...await this.reader.readMemoryMd(memoryMdPath))
    }
    if (dailyNotesDir) {
      entries.push(...await this.reader.readDailyNote(dailyNotesDir, new Date()))
    }
    const digest = digestEntries(entries)
    if (digest === this.lastDigest) return entries
    this.lastDigest = digest
    await this.options.onEntries?.(entries)
    this.options.events?.emit(BRIDGE_EVENTS.MEMORY_SYNCED, { count: entries.length })
    return entries
  }
}

function digestEntries(entries: MemoryEntry[]): string {
  const hash = createHash('sha256')
  for (const entry of entries) hash.update(`${entry.id}\0${entry.content}\n`)
  return hash.digest('hex')
}
