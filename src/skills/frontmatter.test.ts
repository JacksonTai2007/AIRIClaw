import { describe, it, expect } from 'vitest'
import { parseSkillMarkdown } from './frontmatter.js'

const FULL_SKILL = `---
name: video-frames
description: "Extract frames or short clips from videos using ffmpeg."
homepage: https://ffmpeg.org
metadata:
  openclaw:
    emoji: "🎬"
    always: true
    skillKey: vf
    primaryEnv: FFMPEG_BIN
    os: ["darwin", "linux"]
    requires:
      bins: ["ffmpeg"]
      env: ["FFMPEG_BIN"]
    install:
      - id: brew
        kind: brew
        formula: ffmpeg
        bins: ["ffmpeg"]
        label: "Install ffmpeg (brew)"
---

# Video Frames

Extract a single frame from a video.
`

describe('parseSkillMarkdown', () => {
  it('parses nested metadata.openclaw fields', () => {
    const skill = parseSkillMarkdown(FULL_SKILL, {
      sourcePath: '/skills/video-frames/SKILL.md',
    })
    expect(skill.manifest.name).toBe('video-frames')
    expect(skill.manifest.description).toContain('Extract frames')
    const md = skill.manifest.metadata
    expect(md?.emoji).toBe('🎬')
    expect(md?.always).toBe(true)
    expect(md?.skillKey).toBe('vf')
    expect(md?.primaryEnv).toBe('FFMPEG_BIN')
    expect(md?.os).toEqual(['darwin', 'linux'])
    expect(md?.homepage).toBe('https://ffmpeg.org')
    expect(md?.requires?.bins).toEqual(['ffmpeg'])
    expect(md?.requires?.env).toEqual(['FFMPEG_BIN'])
    expect(md?.install?.[0]).toMatchObject({
      id: 'brew',
      kind: 'brew',
      formula: 'ffmpeg',
      bins: ['ffmpeg'],
      label: 'Install ffmpeg (brew)',
    })
  })

  it('captures instructions, baseDir and sourcePath', () => {
    const skill = parseSkillMarkdown(FULL_SKILL, {
      sourcePath: '/skills/video-frames/SKILL.md',
    })
    expect(skill.sourcePath).toBe('/skills/video-frames/SKILL.md')
    expect(skill.baseDir).toBe('/skills/video-frames')
    expect(skill.instructions.startsWith('# Video Frames')).toBe(true)
    expect(skill.instructions.endsWith('a video.')).toBe(true)
    expect(skill.raw).toBe(FULL_SKILL)
  })

  it('infers name from parent directory when frontmatter omits it', () => {
    const raw = `---\ndescription: "no name here"\n---\nbody`
    const skill = parseSkillMarkdown(raw, {
      sourcePath: '/some/path/my-cool-skill/SKILL.md',
    })
    expect(skill.manifest.name).toBe('my-cool-skill')
  })

  it('throws when name cannot be resolved', () => {
    const raw = `---\ndescription: "x"\n---\nbody`
    expect(() => parseSkillMarkdown(raw, { sourcePath: 'SKILL.md' })).toThrow()
  })

  it('maps disable-model-invocation and user-invocable (kebab + camel)', () => {
    const kebab = parseSkillMarkdown(
      `---\nname: a\ndescription: d\ndisable-model-invocation: true\nuser-invocable: true\n---\nb`,
      { sourcePath: '/x/a/SKILL.md' },
    )
    expect(kebab.manifest.disableModelInvocation).toBe(true)
    expect(kebab.manifest.userInvocable).toBe(true)

    const camel = parseSkillMarkdown(
      `---\nname: b\ndescription: d\ndisableModelInvocation: false\nuserInvocable: false\n---\nb`,
      { sourcePath: '/x/b/SKILL.md' },
    )
    expect(camel.manifest.disableModelInvocation).toBe(false)
    expect(camel.manifest.userInvocable).toBe(false)
  })

  it('falls back to bare metadata block (no openclaw nesting)', () => {
    const raw = `---\nname: c\ndescription: d\nmetadata:\n  emoji: "✨"\n  requires:\n    bins: ["foo"]\n---\nbody`
    const skill = parseSkillMarkdown(raw, { sourcePath: '/x/c/SKILL.md' })
    expect(skill.manifest.metadata?.emoji).toBe('✨')
    expect(skill.manifest.metadata?.requires?.bins).toEqual(['foo'])
  })

  it('promotes top-level homepage into metadata', () => {
    const raw = `---\nname: d\ndescription: x\nhomepage: https://example.com\n---\nbody`
    const skill = parseSkillMarkdown(raw, { sourcePath: '/x/d/SKILL.md' })
    expect(skill.manifest.metadata?.homepage).toBe('https://example.com')
  })
})
