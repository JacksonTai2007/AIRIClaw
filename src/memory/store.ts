/**
 * File-backed memory store — MEMORY.md (append-only log), DREAMS.md
 * (consolidated entries), and `daily/YYYY-MM-DD.md` notes.
 */

import type { DreamEntry, MemoryPaths, MemorySearchResult } from './types.js'

import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { chunkMarkdown, keywordSearch, splitDreamEntries } from './markdown.js'

async function readFileOrEmpty(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return ''
    throw error
  }
}

export class MemoryStore {
  constructor(private readonly paths: MemoryPaths) {}

  /** Conventional layout under a base directory. */
  static defaultPaths(baseDir: string): MemoryPaths {
    return {
      memoryMd: join(baseDir, 'MEMORY.md'),
      dreamsMd: join(baseDir, 'DREAMS.md'),
      dailyDir: join(baseDir, 'daily'),
    }
  }

  /** Full MEMORY.md contents, or '' if the file does not exist. */
  async readMemory(): Promise<string> {
    return readFileOrEmpty(this.paths.memoryMd)
  }

  /** Append a timestamped `- [ISO] text` line to MEMORY.md. */
  async appendMemory(text: string): Promise<void> {
    await mkdir(dirname(this.paths.memoryMd), { recursive: true })
    await appendFile(this.paths.memoryMd, `- [${new Date().toISOString()}] ${text}\n`, 'utf8')
  }

  /** Parsed DREAMS.md entries ([] if the file does not exist). */
  async readDreams(): Promise<DreamEntry[]> {
    return splitDreamEntries(await readFileOrEmpty(this.paths.dreamsMd))
  }

  /** Append a note to `dailyDir/YYYY-MM-DD.md`, separated by a blank line. */
  async appendDailyNote(text: string, date: Date = new Date()): Promise<void> {
    await mkdir(this.paths.dailyDir, { recursive: true })
    const path = join(this.paths.dailyDir, `${date.toISOString().slice(0, 10)}.md`)
    const existing = await readFileOrEmpty(path)
    await appendFile(path, existing === '' ? text : `\n\n${text}`, 'utf8')
  }

  /** Keyword search over chunked MEMORY.md. */
  async search(query: string, limit?: number): Promise<MemorySearchResult[]> {
    const chunks = chunkMarkdown(await this.readMemory())
    return keywordSearch(chunks, query, limit)
  }
}
