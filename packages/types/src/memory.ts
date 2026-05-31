export interface MemoryEntry {
  id: string
  content: string
  timestamp: Date
  source: 'airi' | 'openclaw'
  tags?: string[]
  embedding?: number[]
}

export interface MemorySyncConfig {
  enabled: boolean
  memoryMdPath?: string
  dailyNotesDir?: string
  dreamsMdPath?: string
  syncIntervalMs?: number
}

export interface MemoryQuery {
  query: string
  limit?: number
  tags?: string[]
}

export interface DreamEntry {
  id: string
  promotedFrom: string
  content: string
  timestamp: Date
}
