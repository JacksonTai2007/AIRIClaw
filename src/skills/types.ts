/**
 * Skill contracts — manifest, metadata, and policy shapes for SKILL.md files.
 *
 * Mirrors OpenClaw 2026.6.2 skill loading (frontmatter + openclaw metadata
 * block) collapsed into a single local-first module.
 */

/** One install option from the `metadata.openclaw.install[]` block. */
export interface SkillInstallSpec {
  id: string
  kind: 'brew' | 'node' | 'go' | 'uv' | 'download'
  label?: string
  os?: string[]
  formula?: string
  package?: string
  module?: string
  url?: string
  bins?: string[]
}

/** Runtime prerequisites declared by a skill. */
export interface SkillRequires {
  bins?: string[]
  env?: string[]
}

/** The `metadata.openclaw` block from SKILL.md frontmatter. */
export interface SkillMetadata {
  always?: boolean
  emoji?: string
  homepage?: string
  skillKey?: string
  primaryEnv?: string
  os?: string[]
  requires?: SkillRequires
  install?: SkillInstallSpec[]
}

/**
 * Who may invoke the skill.
 * Upstream defaults: `user-invocable` true, `disable-model-invocation` false.
 */
export interface SkillInvocationPolicy {
  userInvocable: boolean
  disableModelInvocation: boolean
}

/** Parsed frontmatter of a SKILL.md file. */
export interface SkillManifest {
  name: string
  description: string
  policy: SkillInvocationPolicy
  metadata?: SkillMetadata
}

/** A fully loaded skill: manifest + instruction body + provenance. */
export interface Skill {
  manifest: SkillManifest
  /** Trimmed markdown body below the frontmatter. */
  instructions: string
  /** Absolute (or caller-provided) path to the SKILL.md file. */
  sourcePath: string
  /** Directory containing the SKILL.md — relative paths resolve against it. */
  baseDir: string
  /** The raw, unmodified file contents. */
  raw: string
}

/** Filter options for SkillRegistry.list(). */
export interface SkillFilter {
  /** Only skills with policy.userInvocable === true. */
  invocableOnly?: boolean
  /** Only skills with metadata.always === true. */
  alwaysOnly?: boolean
}
