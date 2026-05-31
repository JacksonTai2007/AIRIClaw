import { describe, it, expect, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemoryBridge } from './sync.js'

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'airiclaw-mem-'))
  try { await fn(dir) }
  finally { await rm(dir, { recursive: true, force: true }) }
}

describe('MemoryBridge.syncOnce', () => {
  it('returns empty when no sources are configured', async () => {
    const bridge = new MemoryBridge({ config: { enabled: true } })
    expect(await bridge.syncOnce()).toEqual([])
  })

  it('reads MEMORY.md sections', async () => {
    await withTempDir(async (dir) => {
      const memoryMdPath = join(dir, 'MEMORY.md')
      await writeFile(memoryMdPath, '# A\nfirst\n# B\nsecond\n', 'utf8')
      const bridge = new MemoryBridge({
        config: { enabled: true, memoryMdPath, dailyNotesDir: join(dir, 'does-not-exist') },
      })
      const entries = await bridge.syncOnce()
      expect(entries).toHaveLength(2)
    })
  })

  it('skips callback when content has not changed', async () => {
    await withTempDir(async (dir) => {
      const memoryMdPath = join(dir, 'MEMORY.md')
      await writeFile(memoryMdPath, '# A\nfirst\n', 'utf8')
      const onEntries = vi.fn()
      const bridge = new MemoryBridge({ config: { enabled: true, memoryMdPath }, onEntries })
      await bridge.syncOnce()
      await bridge.syncOnce()
      expect(onEntries).toHaveBeenCalledTimes(1)
    })
  })

  it('syncs DREAMS.md when configured', async () => {
    await withTempDir(async (dir) => {
      const dreamsMdPath = join(dir, 'DREAMS.md')
      await writeFile(dreamsMdPath, '# Dream 1\nPromoted from: daily note\ncontent here\n', 'utf8')
      const onDreams = vi.fn()
      const bridge = new MemoryBridge({
        config: { enabled: true, dreamsMdPath },
        onDreams,
      })
      await bridge.syncOnce()
      expect(onDreams).toHaveBeenCalledTimes(1)
      expect(onDreams.mock.calls[0][0]).toHaveLength(1)
    })
  })

  it('fires onEntries again when content changes', async () => {
    await withTempDir(async (dir) => {
      const memoryMdPath = join(dir, 'MEMORY.md')
      await writeFile(memoryMdPath, '# A\nfirst\n', 'utf8')
      const onEntries = vi.fn()
      const bridge = new MemoryBridge({ config: { enabled: true, memoryMdPath }, onEntries })
      await bridge.syncOnce()
      await writeFile(memoryMdPath, '# A\nfirst\n# B\nsecond\n', 'utf8')
      await bridge.syncOnce()
      expect(onEntries).toHaveBeenCalledTimes(2)
    })
  })
})
