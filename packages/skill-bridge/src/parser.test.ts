import { describe, it, expect } from 'vitest'
import { parseSkillMarkdown, extractWorkflow, parseListItems } from './parser.js'

const SAMPLE = `---
name: 1password
description: Set up and use 1Password CLI (op)
bins: op
kind: formula
emoji: "🔐"
tags: [secrets, cli]
user-invocable: true
metadata:
  openclaw:
    always-eligible: true
    primaryEnv: ONEPASSWORD_TOKEN
    requires:
      bins: [op]
    install:
      brew: 1password-cli
---

# 1Password skill

Install and configure the 1Password CLI.

## Workflow

1. Install the CLI: \`brew install 1password-cli\`
2. Sign in with \`op signin\`
3. Verify: \`op whoami\`

## Guardrails

- Never paste secrets into logs
- Prefer \`op run\` / \`op inject\` over exporting variables

## References

- https://developer.1password.com/docs/cli
`

describe('parseSkillMarkdown', () => {
  it('parses manifest from YAML frontmatter', () => {
    const skill = parseSkillMarkdown(SAMPLE, { sourcePath: '/skills/1password/SKILL.md' })
    expect(skill.manifest.name).toBe('1password')
    expect(skill.manifest.description).toBe('Set up and use 1Password CLI (op)')
    expect(skill.manifest.bins).toEqual(['op'])
    expect(skill.manifest.kind).toBe('formula')
    expect(skill.manifest.emoji).toBe('🔐')
    expect(skill.manifest.tags).toEqual(['secrets', 'cli'])
  })

  it('parses new OpenClaw 2026 fields', () => {
    const skill = parseSkillMarkdown(SAMPLE, { sourcePath: '/skills/1password/SKILL.md' })
    expect(skill.manifest['user-invocable']).toBe(true)
    expect(skill.manifest.metadata?.['always-eligible']).toBe(true)
    expect(skill.manifest.metadata?.primaryEnv).toBe('ONEPASSWORD_TOKEN')
    expect(skill.manifest.metadata?.requires?.bins).toEqual(['op'])
    expect(skill.manifest.metadata?.install?.brew).toBe('1password-cli')
  })

  it('extracts workflow steps', () => {
    const skill = parseSkillMarkdown(SAMPLE, { sourcePath: '/skills/1password/SKILL.md' })
    expect(skill.workflow).toHaveLength(3)
    expect(skill.workflow[0]).toMatchObject({ order: 1 })
    expect(skill.workflow[0].description).toContain('Install the CLI')
  })

  it('extracts guardrails and references', () => {
    const skill = parseSkillMarkdown(SAMPLE, { sourcePath: '/skills/1password/SKILL.md' })
    expect(skill.guardrails).toHaveLength(2)
    expect(skill.guardrails[0]).toBe('Never paste secrets into logs')
    expect(skill.references).toEqual(['https://developer.1password.com/docs/cli'])
  })

  it('infers name from directory when missing', () => {
    const body = `---\ndescription: no name here\n---\n# body`
    const skill = parseSkillMarkdown(body, { sourcePath: '/skills/my-skill/SKILL.md' })
    expect(skill.manifest.name).toBe('my-skill')
  })

  it('throws if name cannot be resolved', () => {
    expect(() => parseSkillMarkdown('---\n---\n', { sourcePath: '' })).toThrow(/missing a name/)
  })

  it('parses hidden skills', () => {
    const md = `---\nname: internal\ndescription: hidden skill\nhidden: true\n---\n# body`
    const skill = parseSkillMarkdown(md, { sourcePath: '/skills/internal/SKILL.md' })
    expect(skill.manifest.hidden).toBe(true)
  })

  it('parses command-dispatch skills', () => {
    const md = `---\nname: calc\ndescription: calculator\ncommand-dispatch: tool\ncommand-tool: calculator\n---\n# body`
    const skill = parseSkillMarkdown(md, { sourcePath: '/skills/calc/SKILL.md' })
    expect(skill.manifest['command-dispatch']).toBe('tool')
    expect(skill.manifest['command-tool']).toBe('calculator')
  })
})

describe('extractWorkflow', () => {
  it('attaches commands from a fenced code block to the preceding step', () => {
    const md = `## Workflow\n\n1. Install\n   \`\`\`\n   brew install foo\n   foo --version\n   \`\`\`\n2. Run\n`
    const steps = extractWorkflow(md)
    expect(steps).toHaveLength(2)
    expect(steps[0].commands).toEqual(['   brew install foo', '   foo --version'])
    expect(steps[1].commands).toBeUndefined()
  })

  it('does not treat list items inside code fences as steps', () => {
    const md = `## Workflow\n\n1. Real step\n   \`\`\`\n   - not a step\n   1. also not a step\n   \`\`\`\n`
    expect(extractWorkflow(md)).toHaveLength(1)
  })

  it('returns empty when no workflow section exists', () => {
    expect(extractWorkflow('# only text')).toEqual([])
  })
})

describe('parseListItems', () => {
  it('parses ordered, unordered, and mixed lists', () => {
    expect(parseListItems('1. one\n- two\n* three')).toEqual(['one', 'two', 'three'])
  })

  it('ignores non-list lines and blanks', () => {
    expect(parseListItems('text\n- item\n\n  ')).toEqual(['item'])
  })
})
