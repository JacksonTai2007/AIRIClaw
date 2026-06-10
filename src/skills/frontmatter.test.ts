import { describe, expect, it } from 'vitest'
import { parseSkillMarkdown, resolveSkillKey } from './frontmatter.js'

const FULL_SAMPLE = `---
name: gifgrep
description: "Search GIF providers with CLI/TUI, download results, and extract stills."
user-invocable: true
disable-model-invocation: false
metadata:
  openclaw:
    always: true
    emoji: "🧲"
    homepage: https://gifgrep.com
    skillKey: gif-grep
    primaryEnv: GIFGREP_API_KEY
    os:
      - darwin
      - linux
    requires:
      bins:
        - gifgrep
      env:
        - GIFGREP_API_KEY
    install:
      - id: brew
        kind: brew
        formula: steipete/tap/gifgrep
        bins:
          - gifgrep
        label: Install gifgrep (brew)
      - id: go
        kind: go
        module: github.com/steipete/gifgrep/cmd/gifgrep@latest
        bins:
          - gifgrep
---

# gifgrep

Use \`gifgrep\` to search GIF providers.
`

describe('parseSkillMarkdown', () => {
  it('parses a full sample with metadata.openclaw', () => {
    const skill = parseSkillMarkdown(FULL_SAMPLE, {
      sourcePath: '/skills/gifgrep/SKILL.md',
    })
    expect(skill.manifest.name).toBe('gifgrep')
    expect(skill.manifest.description).toContain('Search GIF providers')
    expect(skill.manifest.policy).toEqual({
      userInvocable: true,
      disableModelInvocation: false,
    })
    const metadata = skill.manifest.metadata
    expect(metadata).toBeDefined()
    expect(metadata?.always).toBe(true)
    expect(metadata?.emoji).toBe('🧲')
    expect(metadata?.homepage).toBe('https://gifgrep.com')
    expect(metadata?.skillKey).toBe('gif-grep')
    expect(metadata?.primaryEnv).toBe('GIFGREP_API_KEY')
    expect(metadata?.os).toEqual(['darwin', 'linux'])
    expect(metadata?.requires).toEqual({
      bins: ['gifgrep'],
      env: ['GIFGREP_API_KEY'],
    })
    expect(metadata?.install).toHaveLength(2)
    expect(metadata?.install?.[0]).toMatchObject({
      id: 'brew',
      kind: 'brew',
      formula: 'steipete/tap/gifgrep',
      bins: ['gifgrep'],
      label: 'Install gifgrep (brew)',
    })
    expect(metadata?.install?.[1]).toMatchObject({
      id: 'go',
      kind: 'go',
      module: 'github.com/steipete/gifgrep/cmd/gifgrep@latest',
    })
    expect(skill.instructions.startsWith('# gifgrep')).toBe(true)
    expect(skill.baseDir).toBe('/skills/gifgrep')
    expect(skill.sourcePath).toBe('/skills/gifgrep/SKILL.md')
    expect(skill.raw).toBe(FULL_SAMPLE)
  })

  it('defaults userInvocable to true when absent', () => {
    const skill = parseSkillMarkdown(
      '---\nname: quiet\ndescription: d\n---\nbody',
      { sourcePath: '/skills/quiet/SKILL.md' },
    )
    expect(skill.manifest.policy.userInvocable).toBe(true)
    expect(skill.manifest.policy.disableModelInvocation).toBe(false)
  })

  it('parses disable-model-invocation', () => {
    const skill = parseSkillMarkdown(
      '---\nname: hidden\ndisable-model-invocation: true\nuser-invocable: false\n---\nbody',
      { sourcePath: '/skills/hidden/SKILL.md' },
    )
    expect(skill.manifest.policy.disableModelInvocation).toBe(true)
    expect(skill.manifest.policy.userInvocable).toBe(false)
  })

  it('infers name from the parent directory of sourcePath', () => {
    const skill = parseSkillMarkdown('---\ndescription: no name\n---\nbody', {
      sourcePath: '/skills/foo/SKILL.md',
    })
    expect(skill.manifest.name).toBe('foo')
  })

  it('throws when no name can be resolved', () => {
    expect(() =>
      parseSkillMarkdown('---\ndescription: d\n---\nbody', {
        sourcePath: 'SKILL.md',
      }),
    ).toThrow(/no name/i)
  })

  it('promotes top-level homepage into metadata when the block lacks it', () => {
    const skill = parseSkillMarkdown(
      [
        '---',
        'name: homey',
        'homepage: https://example.com',
        'metadata:',
        '  openclaw:',
        '    emoji: "🏠"',
        '---',
        'body',
      ].join('\n'),
      { sourcePath: '/skills/homey/SKILL.md' },
    )
    expect(skill.manifest.metadata?.homepage).toBe('https://example.com')
    expect(skill.manifest.metadata?.emoji).toBe('🏠')
  })

  it('does not override an explicit metadata homepage', () => {
    const skill = parseSkillMarkdown(
      [
        '---',
        'name: homey',
        'homepage: https://outer.example.com',
        'metadata:',
        '  openclaw:',
        '    homepage: https://inner.example.com',
        '---',
        'body',
      ].join('\n'),
      { sourcePath: '/skills/homey/SKILL.md' },
    )
    expect(skill.manifest.metadata?.homepage).toBe('https://inner.example.com')
  })

  it('skips install entries with invalid kind', () => {
    const skill = parseSkillMarkdown(
      [
        '---',
        'name: installer',
        'metadata:',
        '  openclaw:',
        '    install:',
        '      - id: apt',
        '        kind: apt',
        '        package: gh',
        '      - id: brew',
        '        kind: brew',
        '        formula: gh',
        '---',
        'body',
      ].join('\n'),
      { sourcePath: '/skills/installer/SKILL.md' },
    )
    expect(skill.manifest.metadata?.install).toHaveLength(1)
    expect(skill.manifest.metadata?.install?.[0]?.kind).toBe('brew')
  })

  it('omits metadata when no block exists', () => {
    const skill = parseSkillMarkdown('---\nname: bare\n---\nbody', {
      sourcePath: '/skills/bare/SKILL.md',
    })
    expect(skill.manifest.metadata).toBeUndefined()
  })
})

describe('resolveSkillKey', () => {
  it('prefers metadata.skillKey over the name', () => {
    const skill = parseSkillMarkdown(FULL_SAMPLE, {
      sourcePath: '/skills/gifgrep/SKILL.md',
    })
    expect(resolveSkillKey(skill)).toBe('gif-grep')
  })

  it('falls back to the manifest name', () => {
    const skill = parseSkillMarkdown('---\nname: plain\n---\nbody', {
      sourcePath: '/skills/plain/SKILL.md',
    })
    expect(resolveSkillKey(skill)).toBe('plain')
  })
})
