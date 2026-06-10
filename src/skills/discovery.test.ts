import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { discoverSkills, loadSkillRegistry } from './discovery.js'

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'airiclaw-skills-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function writeSkill(dir: string, content: string): Promise<void> {
  const skillDir = path.join(root, dir)
  await mkdir(skillDir, { recursive: true })
  await writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf8')
}

describe('discoverSkills', () => {
  it('discovers valid skills and warns on broken ones', async () => {
    await writeSkill('alpha', '---\nname: alpha\ndescription: A\n---\nBody A')
    await writeSkill(
      path.join('nested', 'beta'),
      '---\ndescription: B\n---\nBody B',
    )
    // Broken YAML frontmatter: unclosed flow mapping.
    await writeSkill('broken', '---\nname: {oops\n---\nBody')

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const skills = await discoverSkills(root)
      expect(skills).toHaveLength(2)
      expect(skills.map((s) => s.manifest.name).sort()).toEqual([
        'alpha',
        'beta',
      ])
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]?.[0])).toContain('broken')
    } finally {
      warn.mockRestore()
    }
  })

  it('returns [] when rootDir does not exist', async () => {
    const skills = await discoverSkills(path.join(root, 'does-not-exist'))
    expect(skills).toEqual([])
  })

  it('ignores non-SKILL.md files', async () => {
    await writeSkill('alpha', '---\nname: alpha\n---\nBody')
    await writeFile(path.join(root, 'README.md'), '# not a skill', 'utf8')
    const skills = await discoverSkills(root)
    expect(skills).toHaveLength(1)
  })
})

describe('loadSkillRegistry', () => {
  it('loads discovered skills into a registry', async () => {
    await writeSkill('alpha', '---\nname: alpha\ndescription: A\n---\nBody A')
    await writeSkill('beta', '---\nname: beta\ndescription: B\n---\nBody B')
    const registry = await loadSkillRegistry(root)
    expect(registry.size).toBe(2)
    expect(registry.get('alpha')?.manifest.description).toBe('A')
  })

  it('returns an empty registry for a missing root', async () => {
    const registry = await loadSkillRegistry(path.join(root, 'nope'))
    expect(registry.size).toBe(0)
  })
})
