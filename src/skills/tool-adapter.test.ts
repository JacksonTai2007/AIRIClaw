import { describe, it, expect } from 'vitest'
import { skillToTool, skillsToTools } from './tool-adapter.js'
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

describe('skillToTool', () => {
  it('produces the expected JSON-schema parameter shape', () => {
    const tool = skillToTool(makeSkill('weather'))
    expect(tool.type).toBe('function')
    expect(tool.function.name).toBe('skill_weather')
    expect(tool.function.parameters).toEqual({
      type: 'object',
      properties: {
        args: {
          type: 'string',
          description: 'Arguments / request for the skill',
        },
      },
      required: [],
    })
  })

  it('sanitizes names: lowercase, non-alphanumeric -> _, collapse repeats, trim', () => {
    expect(skillToTool(makeSkill('Video Frames')).function.name).toBe(
      'skill_video_frames',
    )
    expect(skillToTool(makeSkill('apple-notes')).function.name).toBe(
      'skill_apple_notes',
    )
    expect(skillToTool(makeSkill('GH/Issues!!')).function.name).toBe(
      'skill_gh_issues',
    )
    expect(skillToTool(makeSkill('--weird--')).function.name).toBe('skill_weird')
  })

  it('falls back to "skill" when nothing usable remains', () => {
    expect(skillToTool(makeSkill('!!!')).function.name).toBe('skill_skill')
  })

  it('truncates description to ~1024 chars', () => {
    const long = 'x'.repeat(2000)
    const tool = skillToTool(makeSkill('big', { description: long }))
    expect(tool.function.description.length).toBe(1024)
  })

  it('keeps short descriptions intact', () => {
    const tool = skillToTool(makeSkill('short', { description: 'tiny' }))
    expect(tool.function.description).toBe('tiny')
  })
})

describe('skillsToTools', () => {
  it('maps all model-invocable skills', () => {
    const tools = skillsToTools([makeSkill('a'), makeSkill('b')])
    expect(tools.map((t) => t.function.name)).toEqual(['skill_a', 'skill_b'])
  })

  it('excludes skills with disableModelInvocation === true', () => {
    const tools = skillsToTools([
      makeSkill('visible'),
      makeSkill('hidden', { disableModelInvocation: true }),
    ])
    expect(tools.map((t) => t.function.name)).toEqual(['skill_visible'])
  })
})
