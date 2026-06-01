/**
 * Memory layer contracts, modelled on OpenClaw's memory-host-sdk: markdown
 * memory files (MEMORY.md / DREAMS.md / daily notes) are chunked, hashed, and
 * keyword-searched. Shapes mirror the SDK's `chunks` rows (hash, text, line
 * range) so a future embedding index can drop in without changing callers.
 */

/** A contiguous slice of a markdown document. */
export interface MemoryChunk {
  /** Stable hex hash of the chunk text. */
  hash: string
  text: string
  /** Inclusive 1-based [startLine, endLine] within the source document. */
  lines: [number, number]
}

/** A scored chunk returned from a search. */
export interface MemorySearchResult {
  chunk: MemoryChunk
  score: number
  /** Where the chunk came from, e.g. 'memory'. */
  source: string
}

/** A single parsed DREAMS.md entry. */
export interface DreamEntry {
  id: string
  text: string
  /** Wall-clock creation time (ms epoch). */
  createdAt: number
  /** Id of the memory this dream was promoted from, if any. */
  promotedFrom?: string
}

/** Filesystem locations for the memory files. */
export interface MemoryPaths {
  memoryMd: string
  dreamsMd: string
  dailyDir: string
}
