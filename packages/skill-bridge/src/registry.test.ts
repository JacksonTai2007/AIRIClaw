import { describe, it, expect } from 'vitest'
import { SkillRegistry } from './registry.js'
import type { SkillDefinition } from '@airiclaw/types'

function makeSkill(name: string, description = '', tags: string[] = []): SkillDefinition {
  return {
    manifest: { name, description, tags },
    instructions: '',
    workflow: [],
    guardrails: [],
    references: [],
    sourcePath: `/skills/${name}/SKILL.md`,
  }
}

describe('SkillRegistry', () => {
  it('registers and retrieves skills', () => {
    const registry = new SkillRegistry()
    const skill = makeSkill('git', 'Git workflows')
    registry.register(skill)
    expect(registry.has('git')).toBe(true)
    expect(registry.get('git')).toEqual(skill)
    expect(registry.size()).toBe(1)
  })

  it('looks up skills by source path', () => {
    const registry = new SkillRegistry()
    const skill = makeSkill('git')
    registry.register(skill)
    expect(registry.getByPath(skill.sourcePath)?.manifest.name).toBe('git')
    expect(registry.getByPath('/unknown/path')).toBeUndefined()
  })

  it('unregisters by path in O(1)', () => {
    const registry = new SkillRegistry()
    const skill = makeSkill('git')
    registry.register(skill)
    expect(registry.unregisterByPath(skill.sourcePath)).toBe(true)
    expect(registry.has('git')).toBe(false)
    expect(registry.unregisterByPath(skill.sourcePath)).toBe(false)
  })

  it('updates path index when a skill is moved', () => {
    const registry = new SkillRegistry()
    registry.register(makeSkill('git', 'old'))
    const moved: SkillDefinition = { ...makeSkill('git', 'new'), sourcePath: '/skills/new/SKILL.md' }
    registry.register(moved)
    expect(registry.getByPath('/skills/git/SKILL.md')).toBeUndefined()
    expect(registry.getByPath('/skills/new/SKILL.md')?.manifest.description).toBe('new')
  })

  it('filters by kind and tag', () => {
    const registry = new SkillRegistry()
    registry.register(makeSkill('git', 'Git', ['vcs']))
    registry.register(makeSkill('op', 'OnePassword', ['secrets']))
    expect(registry.list({ tag: 'secrets' })).toHaveLength(1)
    expect(registry.list({ tag: 'secrets' })[0].manifest.name).toBe('op')
  })

  it('scores search results by relevance', () => {
    const registry = new SkillRegistry()
    registry.register(makeSkill('git', 'version control'))
    registry.register(makeSkill('github', 'github CLI'))
    registry.register(makeSkill('unrelated', 'has git in description'))

    const results = registry.search('git')
    expect(results.map(s => s.manifest.name)).toEqual(['git', 'github', 'unrelated'])
  })

  it('breaks search-score ties by name for stable order', () => {
    const registry = new SkillRegistry()
    registry.register(makeSkill('zebra', 'tag here', ['secret']))
    registry.register(makeSkill('alpha', 'tag here', ['secret']))
    const results = registry.search('secret')
    expect(results.map(s => s.manifest.name)).toEqual(['alpha', 'zebra'])
  })

  it('clears all skills and indexes', () => {
    const registry = new SkillRegistry()
    const skill = makeSkill('git')
    registry.register(skill)
    registry.clear()
    expect(registry.size()).toBe(0)
    expect(registry.getByPath(skill.sourcePath)).toBeUndefined()
  })
})
