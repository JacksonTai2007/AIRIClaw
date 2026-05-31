import { describe, it, expect } from 'vitest'
import { SkillRegistry } from './registry.js'
import type { SkillDefinition } from '@airiclaw/types'

function makeSkill(name: string, description = '', tags: string[] = [], opts: Partial<SkillDefinition['manifest']> = {}): SkillDefinition {
  return {
    manifest: { name, description, tags, ...opts },
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
  })

  it('unregisters by path in O(1)', () => {
    const registry = new SkillRegistry()
    const skill = makeSkill('git')
    registry.register(skill)
    expect(registry.unregisterByPath(skill.sourcePath)).toBe(true)
    expect(registry.has('git')).toBe(false)
  })

  it('filters by invocableOnly', () => {
    const registry = new SkillRegistry()
    registry.register(makeSkill('public', 'pub', [], { 'user-invocable': true }))
    registry.register(makeSkill('internal', 'int'))
    expect(registry.list({ invocableOnly: true })).toHaveLength(1)
    expect(registry.list({ invocableOnly: true })[0].manifest.name).toBe('public')
  })

  it('excludes hidden skills from search', () => {
    const registry = new SkillRegistry()
    registry.register(makeSkill('visible', 'test skill'))
    registry.register(makeSkill('secret', 'test hidden', [], { hidden: true }))
    const results = registry.search('test')
    expect(results.map(s => s.manifest.name)).toEqual(['visible'])
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
  })
})
