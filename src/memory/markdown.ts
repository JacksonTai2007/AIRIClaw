/**
 * Pure markdown memory helpers — chunking, keyword search, dream parsing.
 * No filesystem access; see {@link MemoryStore} for the IO layer.
 */

import type { DreamEntry, MemoryChunk, MemorySearchResult } from './types.js'

/** FNV-1a 32-bit hash, returned as a zero-padded hex string. */
function fnv1a(text: string): string {
  let hash = 0x811C9DC5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Split markdown into chunks at `#`-heading boundaries and blank-line
 * paragraph breaks. Line ranges are 1-based inclusive; blank chunks are
 * skipped.
 */
export function chunkMarkdown(text: string): MemoryChunk[] {
  const lines = text.split('\n')
  const chunks: MemoryChunk[] = []

  let buffer: string[] = []
  let startLine = 1

  const flush = (): void => {
    const body = buffer.join('\n')
    if (body.trim() !== '') {
      chunks.push({
        hash: fnv1a(body),
        text: body,
        lines: [startLine, startLine + buffer.length - 1],
      })
    }
    buffer = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const lineNo = i + 1

    if (line.trim() === '') {
      // Paragraph break.
      flush()
      continue
    }

    if (/^#{1,6}\s/.test(line))
      flush() // New heading starts a new chunk.

    if (buffer.length === 0)
      startLine = lineNo
    buffer.push(line)
  }
  flush()

  return chunks
}

/**
 * Case-insensitive keyword search: score = total occurrences of every
 * whitespace-split query term; only score > 0, sorted descending, top `limit`.
 */
export function keywordSearch(chunks: MemoryChunk[], query: string, limit = 5): MemorySearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(term => term !== '')
  if (terms.length === 0)
    return []

  const results: MemorySearchResult[] = []
  for (const chunk of chunks) {
    const haystack = chunk.text.toLowerCase()
    let score = 0
    for (const term of terms) {
      let index = haystack.indexOf(term)
      while (index !== -1) {
        score++
        index = haystack.indexOf(term, index + term.length)
      }
    }
    if (score > 0)
      results.push({ chunk, score, source: 'memory' })
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Parse DREAMS.md into entries. Entries are delimited by `## ` headings or
 * `---` horizontal rules; ids come from heading slugs (or `dream-<index>`),
 * and a `promoted-from: <id>` line sets {@link DreamEntry.promotedFrom}.
 */
export function splitDreamEntries(text: string): DreamEntry[] {
  const lines = text.split('\n')
  const blocks: string[][] = []
  let current: string[] = []

  const pushBlock = (): void => {
    if (current.length > 0)
      blocks.push(current)
    current = []
  }

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      pushBlock()
      current.push(line)
    }
    else if (/^-{3,}\s*$/.test(line)) {
      pushBlock()
    }
    else {
      current.push(line)
    }
  }
  pushBlock()

  const now = Date.now()
  const entries: DreamEntry[] = []

  for (const block of blocks) {
    const body = block.join('\n').trim()
    if (body === '')
      continue

    const firstLine = block.find(line => line.trim() !== '') ?? ''
    const heading = /^##\s+(.+?)\s*$/.exec(firstLine)?.[1]
    const slug = heading ? slugify(heading) : ''
    const id = slug !== '' ? slug : `dream-${entries.length}`

    const promotedFrom = /^promoted-from:\s*(\S+)\s*$/m.exec(body)?.[1]

    const entry: DreamEntry = { id, text: body, createdAt: now }
    if (promotedFrom !== undefined)
      entry.promotedFrom = promotedFrom
    entries.push(entry)
  }

  return entries
}
