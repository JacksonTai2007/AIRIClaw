import { readFile } from 'node:fs/promises'
import fg from 'fast-glob'
import chokidar, { type FSWatcher } from 'chokidar'
import type { SkillChangeEvent, SkillDefinition } from '@airiclaw/types'
import { parseSkillMarkdown } from './parser.js'

export class SkillDiscovery {
  constructor(readonly skillsPath: string) {}

  async scanSkills(): Promise<SkillDefinition[]> {
    const files = await fg(['**/SKILL.md', '**/skill.md'], {
      cwd: this.skillsPath,
      absolute: true,
      caseSensitiveMatch: false,
      dot: false,
    })
    const settled = await Promise.all(
      files.map(async (path) => {
        try {
          return await this.loadSkill(path)
        }
        catch (err) {
          console.warn(`[airiclaw] Failed to parse skill at ${path}:`, err)
          return null
        }
      }),
    )
    return settled.filter((s): s is SkillDefinition => s !== null)
  }

  async loadSkill(path: string): Promise<SkillDefinition> {
    const raw = await readFile(path, 'utf8')
    return parseSkillMarkdown(raw, { sourcePath: path })
  }

  watch(onChange: (event: SkillChangeEvent) => void): { close: () => Promise<void> } {
    const watcher: FSWatcher = chokidar.watch(this.skillsPath, {
      ignored: (path: string) => {
        if (path.includes('node_modules')) return true
        if (/\.(swp|swo|tmp)$/i.test(path)) return true
        return false
      },
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    })
    const handle = (type: 'added' | 'changed' | 'removed') => async (path: string) => {
      if (!/SKILL\.md$/i.test(path)) return
      try {
        if (type === 'removed') {
          onChange({ type, path })
          return
        }
        const skill = await this.loadSkill(path)
        onChange({ type, path, skill })
      }
      catch (err) {
        console.warn(`[airiclaw] Skill watch error for ${path}:`, err)
      }
    }
    watcher.on('add', handle('added'))
    watcher.on('change', handle('changed'))
    watcher.on('unlink', handle('removed'))
    return { close: async () => { await watcher.close() } }
  }
}
