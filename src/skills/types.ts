/**
 * Type contracts for the SKILL.md skill system (OpenClaw 2026.5.31 compatible).
 *
 * Skills are markdown files (SKILL.md) with YAML/JSON frontmatter. OpenClaw-specific
 * metadata is nested under `metadata.openclaw`. A parsed Skill carries its manifest,
 * instructions (markdown body), and source location so it can later become a tool.
 */

/** A declarative installation recipe for a skill's external dependency. */
export interface SkillInstallSpec {
  id: string
  kind: 'brew' | 'node' | 'go' | 'uv' | 'download'
  label?: string
  os?: string[]
  formula?: string
  package?: string
  module?: string
  url?: string
  archive?: string
  extract?: boolean
  stripComponents?: number
  targetDir?: string
  bins?: string[]
}

/** Runtime prerequisites a skill needs in order to function. */
export interface SkillRequires {
  bins?: string[]
  env?: string[]
}

/** OpenClaw-specific metadata, normally nested under `metadata.openclaw`. */
export interface SkillMetadata {
  emoji?: string
  always?: boolean
  homepage?: string
  skillKey?: string
  primaryEnv?: string
  os?: string[]
  requires?: SkillRequires
  install?: SkillInstallSpec[]
}

/** The fully resolved manifest derived from a SKILL.md's frontmatter. */
export interface SkillManifest {
  name: string
  description: string
  userInvocable?: boolean
  disableModelInvocation?: boolean
  metadata?: SkillMetadata
}

/** A parsed skill: manifest plus markdown instructions and source location. */
export interface Skill {
  manifest: SkillManifest
  instructions: string
  sourcePath: string
  baseDir: string
  raw: string
}

/** Filter options for listing skills from the registry. */
export interface SkillFilter {
  tag?: string
  invocableOnly?: boolean
}
