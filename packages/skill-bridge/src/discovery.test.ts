import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SkillDiscovery } from './discovery.js'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'airiclaw-test-'))
  await mkdir(join(root, 'git'), { recursive: true })
  await writeFile(join(root, 'git', 'SKILL.md'), `---
name: git
description: Git workflows
---
# Git
`, 'utf8')
  await mkdir(join(root, 'op'), { recursive: true })
  await writeFile(join(root, 'op', 'SKILL.md'), `---
name: op
description: 1Password CLI
bins: op
---
# op
`, 'utf8')
  await mkdir(join(root, 'broken'), { recursive: true })
  await writeFile(join(root, 'broken', 'SKILL.md'), `---
name: [unclosed-array
description: invalid yaml
---
`, 'utf8')
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('SkillDiscovery', () => {
  it('scans all skills in the directory', async () => {
    const discovery = new SkillDiscovery(root)
    const skills = await discovery.scanSkills()
    const names = skills.map(s => s.manifest.name).sort()
    expect(names).toContain('git')
    expect(names).toContain('op')
  })

  it('continues past unparseable skills', async () => {
    const discovery = new SkillDiscovery(root)
    const skills = await discovery.scanSkills()
    expect(skills.find(s => s.manifest.description === 'invalid yaml')).toBeUndefined()
    expect(skills.length).toBeGreaterThanOrEqual(2)
  })

  it('loads a skill directly by path', async () => {
    const discovery = new SkillDiscovery(root)
    const skill = await discovery.loadSkill(join(root, 'git', 'SKILL.md'))
    expect(skill.manifest.name).toBe('git')
  })
})
