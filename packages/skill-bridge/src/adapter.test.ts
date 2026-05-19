import { describe, it, expect } from 'vitest'
import { SkillToMCPAdapter } from './adapter.js'
import type { SkillDefinition } from '@airiclaw/types'

const skill: SkillDefinition = {
  manifest: {
    name: '1password',
    description: 'Set up and use 1Password CLI',
    bins: ['op'],
    kind: 'formula',
  },
  instructions: 'body',
  workflow: [
    { order: 1, description: 'Install CLI' },
    { order: 2, description: 'Sign in' },
    { order: 3, description: 'Verify' },
    { order: 4, description: 'Use' },
  ],
  guardrails: ['no secrets in logs'],
  references: [],
  sourcePath: '/skills/1password/SKILL.md',
}

describe('SkillToMCPAdapter', () => {
  const adapter = new SkillToMCPAdapter()

  it('adapts a skill to an MCP tool definition', () => {
    const tool = adapter.adapt(skill)
    expect(tool.name).toBe('1password')
    expect(tool.source).toBe('openclaw-skill')
    expect(tool.skillName).toBe('1password')
    expect(tool.description).toContain('Set up and use 1Password CLI')
    expect(tool.description).toContain('Requires: op')
  })

  it('produces a valid JSON Schema input', () => {
    const tool = adapter.adapt(skill)
    expect(tool.inputSchema).toMatchObject({
      type: 'object',
      required: ['query'],
    })
  })

  it('sanitizes MCP tool names', () => {
    const weird = adapter.adapt({ ...skill, manifest: { ...skill.manifest, name: 'foo bar/baz@1' } })
    expect(weird.name).toMatch(/^[a-zA-Z0-9_-]+$/)
  })
})
