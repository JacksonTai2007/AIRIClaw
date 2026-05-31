import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MemoryEntry, DreamEntry } from '@airiclaw/types'

export class MarkdownMemoryReader {
  async readMemoryMd(path: string): Promise<MemoryEntry[]> {
    const raw = await readOrEmpty(path)
    return raw ? splitToEntries(raw, path) : []
  }

  async readDailyNote(dir: string, date: Date): Promise<MemoryEntry[]> {
    const iso = date.toISOString().slice(0, 10)
    const path = join(dir, `${iso}.md`)
    const raw = await readOrEmpty(path)
    return raw ? splitToEntries(raw, path) : []
  }

  async readDreamsMd(path: string): Promise<DreamEntry[]> {
    const raw = await readOrEmpty(path)
    if (!raw) return []
    return splitToDreamEntries(raw, path)
  }
}

async function readOrEmpty(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  }
  catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

function splitToEntries(raw: string, sourcePath: string): MemoryEntry[] {
  const sections = raw.split(/\n(?=#{1,6}\s)/).map(s => s.trim()).filter(Boolean)
  return sections.map((content, i) => ({
    id: `${sourcePath}#${i}`,
    content,
    timestamp: new Date(),
    source: 'openclaw' as const,
  }))
}

function splitToDreamEntries(raw: string, sourcePath: string): DreamEntry[] {
  const sections = raw.split(/\n(?=#{1,6}\s)/).map(s => s.trim()).filter(Boolean)
  return sections.map((content, i) => ({
    id: `${sourcePath}#dream-${i}`,
    promotedFrom: extractPromotedFrom(content),
    content,
    timestamp: new Date(),
  }))
}

function extractPromotedFrom(content: string): string {
  const match = content.match(/promoted from:?\s*`?([^`\n]+)`?/i)
  return match?.[1]?.trim() ?? 'unknown'
}
