/**
 * Filesystem-backed memory store over the OpenClaw-style memory files:
 * MEMORY.md (long-term notes), DREAMS.md (promoted/reflective entries), and
 * daily/YYYY-MM-DD.md notes. Reads are lenient (missing files read as empty);
 * writes create parent directories on demand.
 */

import { dirname, join } from 'node:path'
import { appendFile, mkdir, readFile } from 'node:fs/promises'

import { chunkMarkdown, keywordSearch, splitDreamEntries } from './markdown.js'
import type { DreamEntry, MemoryPaths, MemorySearchResult } from './types.js'

function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ENOENT'
}

/** Format a Date as a local YYYY-MM-DD string. */
function ymd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export class MemoryStore {
  constructor(private readonly paths: MemoryPaths) {}

  /** Default file layout under a base directory. */
  static defaultPaths(baseDir: string): MemoryPaths {
    return {
      memoryMd: join(baseDir, 'MEMORY.md'),
      dreamsMd: join(baseDir, 'DREAMS.md'),
      dailyDir: join(baseDir, 'daily'),
    }
  }

  /** Read MEMORY.md, or '' if it does not exist yet. */
  async readMemory(): Promise<string> {
    return this.readFileOrEmpty(this.paths.memoryMd)
  }

  /** Append a timestamped bullet to MEMORY.md, creating it if needed. */
  async appendMemory(text: string): Promise<void> {
    const bullet = `- [${new Date().toISOString()}] ${text.trim()}\n`
    await this.appendCreating(this.paths.memoryMd, bullet)
  }

  /** Read and parse DREAMS.md into entries, or [] if it does not exist. */
  async readDreams(): Promise<DreamEntry[]> {
    const text = await this.readFileOrEmpty(this.paths.dreamsMd)
    if (text === '')
      return []
    return splitDreamEntries(text)
  }

  /** Append a note to daily/YYYY-MM-DD.md (defaults to today). */
  async appendDailyNote(text: string, date: Date = new Date()): Promise<void> {
    const file = join(this.paths.dailyDir, `${ymd(date)}.md`)
    const bullet = `- [${date.toISOString()}] ${text.trim()}\n`
    await this.appendCreating(file, bullet)
  }

  /** Keyword-search MEMORY.md and return the top matching chunks. */
  async search(query: string, limit?: number): Promise<MemorySearchResult[]> {
    const text = await this.readMemory()
    if (text === '')
      return []
    const chunks = chunkMarkdown(text)
    return keywordSearch(chunks, query, limit)
  }

  private async readFileOrEmpty(path: string): Promise<string> {
    try {
      return await readFile(path, 'utf8')
    }
    catch (err) {
      if (isNotFound(err))
        return ''
      throw err
    }
  }

  private async appendCreating(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
    await appendFile(path, content, 'utf8')
  }
}
