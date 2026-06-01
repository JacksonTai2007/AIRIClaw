import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { MemoryStore } from './store.js'

describe('MemoryStore', () => {
  let dir: string
  let store: MemoryStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'airiclaw-mem-'))
    store = new MemoryStore(MemoryStore.defaultPaths(dir))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reads empty when MEMORY.md is missing', async () => {
    expect(await store.readMemory()).toBe('')
    expect(await store.readDreams()).toEqual([])
  })

  it('appendMemory then readMemory roundtrips', async () => {
    await store.appendMemory('user prefers dark mode')
    const text = await store.readMemory()
    expect(text).toContain('user prefers dark mode')
    expect(text).toMatch(/^- \[/)
  })

  it('appendDailyNote creates a dated file', async () => {
    const date = new Date('2026-06-01T12:00:00.000Z')
    await store.appendDailyNote('shipped the memory module', date)
    const file = join(dir, 'daily', '2026-06-01.md')
    const content = await readFile(file, 'utf8')
    expect(content).toContain('shipped the memory module')
  })

  it('search finds an appended line', async () => {
    await store.appendMemory('the project is called AIRIClaw')
    await store.appendMemory('unrelated note about weather')
    const results = await store.search('AIRIClaw')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.chunk.text).toContain('AIRIClaw')
    expect(results[0]!.source).toBe('memory')
  })
})
