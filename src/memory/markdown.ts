/**
 * Pure markdown helpers for the memory layer — no filesystem access. Splits
 * documents into hashed, line-ranged chunks; keyword-scores them; and parses
 * DREAMS.md entries. Hashing uses an inline FNV-1a so chunk ids are stable
 * across processes without any dependency.
 */

import type { DreamEntry, MemoryChunk, MemorySearchResult } from './types.js'

/** FNV-1a 32-bit string hash, returned as an 8-char hex string. */
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    // 32-bit FNV prime multiply via shifts to stay in integer range.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Split markdown into chunks. A new chunk starts at every heading line (`#`)
 * and after every blank line (paragraph break). Each chunk records its inclusive
 * 1-based line range and a stable hash. Empty chunks are skipped.
 */
export function chunkMarkdown(text: string): MemoryChunk[] {
  const lines = text.split('\n')
  const chunks: MemoryChunk[] = []

  let buffer: string[] = []
  let start = 0 // 0-based index of the first line in `buffer`

  const flush = (endExclusive: number): void => {
    const content = buffer.join('\n').trim()
    if (content.length > 0) {
      chunks.push({
        hash: fnv1aHex(content),
        text: content,
        lines: [start + 1, endExclusive],
      })
    }
    buffer = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const isHeading = /^#{1,6}\s/.test(line)
    const isBlank = line.trim() === ''

    if (isHeading) {
      // Close the previous chunk (ending on the prior line), begin a new one.
      if (buffer.length > 0)
        flush(i)
      start = i
      buffer.push(line)
      continue
    }

    if (isBlank) {
      if (buffer.length > 0)
        flush(i)
      // Skip the blank line itself; next non-blank line opens a new chunk.
      start = i + 1
      continue
    }

    if (buffer.length === 0)
      start = i
    buffer.push(line)
  }

  if (buffer.length > 0)
    flush(lines.length)

  return chunks
}

/**
 * Score chunks by the total number of query-term occurrences (terms are the
 * whitespace-split, lowercased words of `query`). Returns the top `limit`
 * chunks with score > 0, sorted by score descending.
 */
export function keywordSearch(
  chunks: MemoryChunk[],
  query: string,
  limit = 5,
): MemorySearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0)
    return []

  const results: MemorySearchResult[] = []
  for (const chunk of chunks) {
    const haystack = chunk.text.toLowerCase()
    let score = 0
    for (const term of terms) {
      let from = 0
      for (;;) {
        const idx = haystack.indexOf(term, from)
        if (idx === -1)
          break
        score++
        from = idx + term.length
      }
    }
    if (score > 0)
      results.push({ chunk, score, source: 'memory' })
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Parse a DREAMS.md document. Entries are delimited by `## ` headings or `---`
 * horizontal rules. Each entry's id comes from its heading slug (or its index
 * if it has none). A `promoted-from: <id>` line marks the source memory.
 */
export function splitDreamEntries(text: string): DreamEntry[] {
  const lines = text.split('\n')

  // Collect raw blocks of lines, splitting on `## ` headings and `---` rules.
  const blocks: string[][] = []
  let current: string[] = []

  const pushCurrent = (): void => {
    if (current.some(l => l.trim() !== ''))
      blocks.push(current)
    current = []
  }

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      pushCurrent()
      current.push(line)
      continue
    }
    if (/^-{3,}\s*$/.test(line)) {
      pushCurrent()
      continue
    }
    current.push(line)
  }
  pushCurrent()

  const entries: DreamEntry[] = []
  blocks.forEach((block, index) => {
    const headingLine = block.find(l => /^##\s/.test(l))
    const heading = headingLine ? headingLine.replace(/^##\s+/, '').trim() : ''

    const promotedLine = block.find(l => /^\s*promoted-from:\s*/i.test(l))
    const promotedFrom = promotedLine
      ? promotedLine.replace(/^\s*promoted-from:\s*/i, '').trim()
      : undefined

    const text = block
      .filter(l => l !== headingLine && l !== promotedLine)
      .join('\n')
      .trim()

    const id = heading ? slugify(heading) || String(index) : String(index)

    entries.push({
      id,
      text,
      createdAt: Date.now(),
      ...(promotedFrom ? { promotedFrom } : {}),
    })
  })

  return entries
}
