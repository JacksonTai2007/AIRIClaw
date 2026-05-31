import { describe, it, expect } from 'vitest'
import { SkillToMCPAdapter } from './adapter.js'
import type { SkillDefinition } from '@airiclaw/types'

function makeSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
  return {
    manifest: {
      name: 'git',
      description: 'Git workflows',
      bins: ['git'],
      tags: ['vcs'],
      ...overrides.manifest,
    } as SkillDefinition['manifest'],
    instructions: overrides.instructions ?? '# Git\nUse git.',
    workflow: overrides.workflow ?? [
      { order: 1, description: 'Check status' },
      { order: 2, description: 'Stage changes' },
    ],
    guardrails: overrides.guardrails ?? ['Do not force push'],
    references: overrides.references ?? [],
    sourcePath: overrides.sourcePath ?? '/skills/git/SKILL.md',
  }
}

describe('SkillToMCPAdapter', () => {
  const adapter = new SkillToMCPAdapter()

  it('converts a skill to an MCP tool definition', () => {
    const tool = adapter.adapt(makeSkill())
    expect(tool.name).toBe('git')
    expect(tool.source).toBe('openclaw-skill')
    expect(tool.skillName).toBe('git')
    expect(tool.description).toContain('Git workflows')
    expect(tool.description).toContain('Requires: git')
    expect(tool.description).toContain('Workflow:')
  })

  it('sanitizes names with special characters', () => {
    const tool = adapter.adapt(makeSkill({
      manifest: { name: 'my@cool/skill!', description: '' } as any,
    }))
    expect(tool.name).toMatch(/^[a-zA-Z0-9_-]+$/)
  })

  it('truncates names longer than 64 characters', () => {
    const tool = adapter.adapt(makeSkill({
      manifest: { name: 'a'.repeat(100), description: '' } as any,
    }))
    expect(tool.name.length).toBeLessThanOrEqual(64)
  })

  it('falls back to "skill" for empty names', () => {
    const tool = adapter.adapt(makeSkill({
      manifest: { name: '', description: '' } as any,
    }))
    expect(tool.name).toBe('skill')
  })

  it('builds input schema with query and args', () => {
    const tool = adapter.adapt(makeSkill())
    expect(tool.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        query: { type: 'string' },
        args: { type: 'object' },
      },
      required: ['query'],
    })
  })

  it('adaptAll converts multiple skills', () => {
    const tools = adapter.adaptAll([
      makeSkill(),
      makeSkill({ manifest: { name: 'npm', description: 'npm tools' } as any }),
    ])
    expect(tools).toHaveLength(2)
    expect(tools.map(t => t.name)).toEqual(['git', 'npm'])
  })

  it('omits workflow preview when no workflow steps exist', () => {
    const tool = adapter.adapt(makeSkill({ workflow: [] }))
    expect(tool.description).not.toContain('Workflow:')
  })

  it('omits requires line when no bins are present', () => {
    const tool = adapter.adapt(makeSkill({
      manifest: { name: 'notes', description: 'Note taking', bins: undefined } as any,
    }))
    expect(tool.description).not.toContain('Requires:')
  })
})
