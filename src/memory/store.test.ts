import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { MemoryStore } from './store.js'

describe('MemoryStore', () => {
  let baseDir: string
  let store: MemoryStore

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'airiclaw-memory-'))
    store = new MemoryStore(MemoryStore.defaultPaths(baseDir))
  })

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true })
  })

  it('defaultPaths lays out MEMORY.md / DREAMS.md / daily', () => {
    expect(MemoryStore.defaultPaths('/base')).toEqual({
      memoryMd: join('/base', 'MEMORY.md'),
      dreamsMd: join('/base', 'DREAMS.md'),
      dailyDir: join('/base', 'daily'),
    })
  })

  it('readMemory returns empty string when the file is missing', async () => {
    expect(await store.readMemory()).toBe('')
  })

  it('appendMemory/readMemory round-trips timestamped lines', async () => {
    await store.appendMemory('first fact')
    await store.appendMemory('second fact')

    const content = await store.readMemory()
    const lines = content.trimEnd().split('\n')

    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^- \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] first fact$/)
    expect(lines[1]).toMatch(/second fact$/)
  })

  it('appendDailyNote creates a dated file and separates notes', async () => {
    const date = new Date('2026-06-10T12:00:00Z')
    await store.appendDailyNote('morning note', date)
    await store.appendDailyNote('evening note', date)

    const content = await readFile(join(baseDir, 'daily', '2026-06-10.md'), 'utf8')
    expect(content).toBe('morning note\n\nevening note')
  })

  it('search finds appended text', async () => {
    await store.appendMemory('the user loves rooibos tea')
    await store.appendMemory('completely unrelated entry')

    const results = await store.search('rooibos')

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.chunk.text).toContain('rooibos tea')
    expect(results[0]?.source).toBe('memory')
    expect(results[0]?.score).toBeGreaterThan(0)
  })

  it('readDreams parses DREAMS.md entries', async () => {
    await writeFile(
      join(baseDir, 'DREAMS.md'),
      '## A Quiet Dream\npromoted-from: mem-1\nbody\n---\nanother dream',
      'utf8',
    )

    const dreams = await store.readDreams()
    expect(dreams).toHaveLength(2)
    expect(dreams[0]?.id).toBe('a-quiet-dream')
    expect(dreams[0]?.promotedFrom).toBe('mem-1')

    // Missing file → no entries.
    await rm(join(baseDir, 'DREAMS.md'))
    expect(await store.readDreams()).toEqual([])
  })
})
