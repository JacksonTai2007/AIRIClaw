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

  it('reads MEMORY.md sections and skips missing files without throwing', async () => {
    await withTempDir(async (dir) => {
      const memoryMdPath = join(dir, 'MEMORY.md')
      await writeFile(memoryMdPath, '# A\nfirst\n# B\nsecond\n', 'utf8')
      const bridge = new MemoryBridge({
        config: {
          enabled: true,
          memoryMdPath,
          dailyNotesDir: join(dir, 'does-not-exist'),
        },
      })
      const entries = await bridge.syncOnce()
      expect(entries).toHaveLength(2)
    })
  })

  it('skips onEntries callback when content has not changed', async () => {
    await withTempDir(async (dir) => {
      const memoryMdPath = join(dir, 'MEMORY.md')
      await writeFile(memoryMdPath, '# A\nfirst\n', 'utf8')
      const onEntries = vi.fn()
      const bridge = new MemoryBridge({
        config: { enabled: true, memoryMdPath },
        onEntries,
      })
      await bridge.syncOnce()
      await bridge.syncOnce()
      await bridge.syncOnce()
      expect(onEntries).toHaveBeenCalledTimes(1)
    })
  })

  it('fires onEntries again when content changes', async () => {
    await withTempDir(async (dir) => {
      const memoryMdPath = join(dir, 'MEMORY.md')
      await writeFile(memoryMdPath, '# A\nfirst\n', 'utf8')
      const onEntries = vi.fn()
      const bridge = new MemoryBridge({
        config: { enabled: true, memoryMdPath },
        onEntries,
      })
      await bridge.syncOnce()
      await mkdir(dir, { recursive: true })
      await writeFile(memoryMdPath, '# A\nfirst\n# B\nsecond\n', 'utf8')
      await bridge.syncOnce()
      expect(onEntries).toHaveBeenCalledTimes(2)
    })
  })
})
