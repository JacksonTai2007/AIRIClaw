import { describe, expect, it } from 'vitest'
import { skillToTool, skillsToTools } from './tool-adapter.js'
import type { Skill } from './types.js'

function makeSkill(
  name: string,
  overrides: { description?: string; disableModelInvocation?: boolean } = {},
): Skill {
  return {
    manifest: {
      name,
      description: overrides.description ?? `${name} description`,
      policy: {
        userInvocable: true,
        disableModelInvocation: overrides.disableModelInvocation ?? false,
      },
    },
    instructions: 'body',
    sourcePath: `/skills/${name}/SKILL.md`,
    baseDir: `/skills/${name}`,
    raw: '',
  }
}

describe('skillToTool', () => {
  it('sanitizes names', () => {
    expect(skillToTool(makeSkill('My Skill!')).function.name).toBe(
      'skill_my_skill',
    )
    expect(skillToTool(makeSkill('gif-grep')).function.name).toBe(
      'skill_gif_grep',
    )
    expect(skillToTool(makeSkill('__Already__Weird__')).function.name).toBe(
      'skill_already_weird',
    )
    expect(skillToTool(makeSkill('---')).function.name).toBe('skill_skill')
    expect(skillToTool(makeSkill('A1 b2')).function.name).toBe('skill_a1_b2')
  })

  it('truncates description to 1024 characters', () => {
    const tool = skillToTool(makeSkill('long', { description: 'x'.repeat(5000) }))
    expect(tool.function.description).toHaveLength(1024)
    expect(tool.function.description).toBe('x'.repeat(1024))
  })

  it('produces the expected schema shape', () => {
    const tool = skillToTool(makeSkill('shape', { description: 'd' }))
    expect(tool).toEqual({
      type: 'function',
      function: {
        name: 'skill_shape',
        description: 'd',
        parameters: {
          type: 'object',
          properties: {
            args: {
              type: 'string',
              description: 'Arguments or request details for the skill',
            },
          },
          required: [],
        },
      },
    })
  })
})

describe('skillsToTools', () => {
  it('excludes model-disabled skills', () => {
    const tools = skillsToTools([
      makeSkill('alpha'),
      makeSkill('hidden', { disableModelInvocation: true }),
      makeSkill('beta'),
    ])
    expect(tools.map((t) => t.function.name)).toEqual([
      'skill_alpha',
      'skill_beta',
    ])
  })
})
