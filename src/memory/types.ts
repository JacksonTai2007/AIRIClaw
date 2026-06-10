/**
 * Memory contracts — markdown-file-backed long-term memory
 * (MEMORY.md / DREAMS.md / daily notes).
 */

/** One chunk of a markdown memory file. */
export interface MemoryChunk {
  /** FNV-1a hash (hex) of the chunk text — stable identity across reads. */
  hash: string
  text: string
  /** 1-based inclusive [startLine, endLine] in the source file. */
  lines: [number, number]
}

/** A scored search hit. */
export interface MemorySearchResult {
  chunk: MemoryChunk
  score: number
  /** Which store produced the hit, e.g. 'memory'. */
  source: string
}

/** One entry in DREAMS.md (consolidated / "dreamed" memories). */
export interface DreamEntry {
  id: string
  text: string
  /** ms epoch at parse time. */
  createdAt: number
  /** Memory id this dream was promoted from, if any. */
  promotedFrom?: string
}

/** Filesystem layout of the memory store. */
export interface MemoryPaths {
  memoryMd: string
  dreamsMd: string
  dailyDir: string
}
