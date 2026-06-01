import { describe, it, expect } from 'vitest'
import { SkillRegistry } from './registry.js'
import type { Skill } from './types.js'

function makeSkill(
  name: string,
  overrides: Partial<Skill['manifest']> = {},
): Skill {
  return {
    manifest: {
      name,
      description: `Description for ${name}`,
      ...overrides,
    },
    instructions: `Instructions for ${name}`,
    sourcePath: `/skills/${name}/SKILL.md`,
    baseDir: `/skills/${name}`,
    raw: `--- name: ${name} ---`,
  }
}

describe('SkillRegistry', () => {
  it('adds, gets, and reports size', () => {
    const reg = new SkillRegistry()
    expect(reg.size).toBe(0)
    const s = makeSkill('alpha')
    reg.add(s)
    expect(reg.size).toBe(1)
    expect(reg.get('alpha')).toBe(s)
    expect(reg.get('missing')).toBeUndefined()
  })

  it('replaces an existing skill with the same name', () => {
    const reg = new SkillRegistry()
    reg.add(makeSkill('dup', { description: 'first' }))
    reg.add(makeSkill('dup', { description: 'second' }))
    expect(reg.size).toBe(1)
    expect(reg.get('dup')?.manifest.description).toBe('second')
  })

  it('all() returns skills in insertion order', () => {
    const reg = new SkillRegistry()
    reg.add(makeSkill('one'))
    reg.add(makeSkill('two'))
    reg.add(makeSkill('three'))
    expect(reg.all().map((s) => s.manifest.name)).toEqual(['one', 'two', 'three'])
  })

  it('list() returns all skills when no filter is given', () => {
    const reg = new SkillRegistry()
    reg.add(makeSkill('a'))
    reg.add(makeSkill('b'))
    expect(reg.list()).toHaveLength(2)
  })

  it('list() filters by invocableOnly (userInvocable === true)', () => {
    const reg = new SkillRegistry()
    reg.add(makeSkill('invocable', { userInvocable: true }))
    reg.add(makeSkill('not-invocable', { userInvocable: false }))
    reg.add(makeSkill('unset'))
    const result = reg.list({ invocableOnly: true })
    expect(result.map((s) => s.manifest.name)).toEqual(['invocable'])
  })

  it('list() filters by tag against requires bins/env and name', () => {
    const reg = new SkillRegistry()
    reg.add(
      makeSkill('ff', {
        metadata: { requires: { bins: ['ffmpeg'] } },
      }),
    )
    reg.add(
      makeSkill('env-skill', {
        metadata: { requires: { env: ['MY_TOKEN'] } },
      }),
    )
    reg.add(makeSkill('plain'))

    expect(reg.list({ tag: 'ffmpeg' }).map((s) => s.manifest.name)).toEqual(['ff'])
    expect(reg.list({ tag: 'MY_TOKEN' }).map((s) => s.manifest.name)).toEqual([
      'env-skill',
    ])
    expect(reg.list({ tag: 'plain' }).map((s) => s.manifest.name)).toEqual(['plain'])
    expect(reg.list({ tag: 'nope' })).toHaveLength(0)
  })

  it('search() does case-insensitive substring match over name + description', () => {
    const reg = new SkillRegistry()
    reg.add(makeSkill('weather', { description: 'Get the forecast' }))
    reg.add(makeSkill('notes', { description: 'Manage Apple Notes' }))

    expect(reg.search('WEATH').map((s) => s.manifest.name)).toEqual(['weather'])
    expect(reg.search('forecast').map((s) => s.manifest.name)).toEqual(['weather'])
    expect(reg.search('apple').map((s) => s.manifest.name)).toEqual(['notes'])
  })

  it('search() with empty query returns all model-discoverable skills', () => {
    const reg = new SkillRegistry()
    reg.add(makeSkill('a'))
    reg.add(makeSkill('b'))
    expect(reg.search('')).toHaveLength(2)
  })

  it('search() excludes skills with disableModelInvocation === true', () => {
    const reg = new SkillRegistry()
    reg.add(makeSkill('visible', { description: 'shared keyword' }))
    reg.add(
      makeSkill('hidden', {
        description: 'shared keyword',
        disableModelInvocation: true,
      }),
    )
    const result = reg.search('shared')
    expect(result.map((s) => s.manifest.name)).toEqual(['visible'])
  })
})
