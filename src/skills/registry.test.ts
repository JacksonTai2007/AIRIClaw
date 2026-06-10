import { describe, expect, it } from 'vitest'
import { SkillRegistry } from './registry.js'
import type { Skill } from './types.js'

function makeSkill(
  name: string,
  overrides: {
    description?: string
    userInvocable?: boolean
    disableModelInvocation?: boolean
    always?: boolean
    skillKey?: string
  } = {},
): Skill {
  return {
    manifest: {
      name,
      description: overrides.description ?? `${name} description`,
      policy: {
        userInvocable: overrides.userInvocable ?? true,
        disableModelInvocation: overrides.disableModelInvocation ?? false,
      },
      metadata:
        overrides.always !== undefined || overrides.skillKey !== undefined
          ? { always: overrides.always, skillKey: overrides.skillKey }
          : undefined,
    },
    instructions: 'body',
    sourcePath: `/skills/${name}/SKILL.md`,
    baseDir: `/skills/${name}`,
    raw: '',
  }
}

describe('SkillRegistry', () => {
  it('adds, gets, and reports size', () => {
    const registry = new SkillRegistry()
    registry.add(makeSkill('alpha'))
    registry.add(makeSkill('beta'))
    expect(registry.size).toBe(2)
    expect(registry.get('alpha')?.manifest.name).toBe('alpha')
    expect(registry.get('missing')).toBeUndefined()
    expect(registry.all()).toHaveLength(2)
  })

  it('gets by skillKey', () => {
    const registry = new SkillRegistry()
    registry.add(makeSkill('gifgrep', { skillKey: 'gif-grep' }))
    expect(registry.get('gif-grep')?.manifest.name).toBe('gifgrep')
    expect(registry.get('gifgrep')?.manifest.name).toBe('gifgrep')
  })

  it('list filters by invocableOnly', () => {
    const registry = new SkillRegistry()
    registry.add(makeSkill('open'))
    registry.add(makeSkill('locked', { userInvocable: false }))
    const invocable = registry.list({ invocableOnly: true })
    expect(invocable.map((s) => s.manifest.name)).toEqual(['open'])
    expect(registry.list()).toHaveLength(2)
  })

  it('list filters by alwaysOnly', () => {
    const registry = new SkillRegistry()
    registry.add(makeSkill('pinned', { always: true }))
    registry.add(makeSkill('lazy'))
    registry.add(makeSkill('explicit-off', { always: false }))
    const always = registry.list({ alwaysOnly: true })
    expect(always.map((s) => s.manifest.name)).toEqual(['pinned'])
  })

  it('search matches name and description case-insensitively', () => {
    const registry = new SkillRegistry()
    registry.add(makeSkill('github', { description: 'GitHub CLI for PRs' }))
    registry.add(makeSkill('weather', { description: 'Forecast lookups' }))
    expect(registry.search('GITHUB').map((s) => s.manifest.name)).toEqual([
      'github',
    ])
    expect(registry.search('forecast').map((s) => s.manifest.name)).toEqual([
      'weather',
    ])
  })

  it('search excludes model-disabled skills', () => {
    const registry = new SkillRegistry()
    registry.add(makeSkill('visible', { description: 'shared keyword' }))
    registry.add(
      makeSkill('secret', {
        description: 'shared keyword',
        disableModelInvocation: true,
      }),
    )
    expect(registry.search('shared').map((s) => s.manifest.name)).toEqual([
      'visible',
    ])
  })

  it('empty search query returns all model-invocable skills', () => {
    const registry = new SkillRegistry()
    registry.add(makeSkill('a'))
    registry.add(makeSkill('b', { disableModelInvocation: true }))
    registry.add(makeSkill('c'))
    expect(registry.search('').map((s) => s.manifest.name)).toEqual(['a', 'c'])
  })
})
