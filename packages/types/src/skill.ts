/**
 * OpenClaw skill manifest (from SKILL.md YAML frontmatter)
 */
export interface SkillManifest {
  name: string
  description: string
  emoji?: string
  bins?: string[]
  kind?: 'formula' | 'workflow' | 'reference' | string
  label?: string
  homepage?: string
  version?: string
  tags?: string[]
}

export interface WorkflowStep {
  order: number
  description: string
  commands?: string[]
}

export interface SkillDefinition {
  manifest: SkillManifest
  instructions: string
  workflow: WorkflowStep[]
  guardrails: string[]
  references: string[]
  sourcePath: string
}

export interface SkillFilter {
  kind?: string
  tag?: string
  search?: string
}

export type SkillChangeEventType = 'added' | 'changed' | 'removed'

export interface SkillChangeEvent {
  type: SkillChangeEventType
  path: string
  skill?: SkillDefinition
}

export interface SkillResult {
  ok: boolean
  output?: string
  error?: string
  durationMs?: number
}

export interface PrereqCheckResult {
  satisfied: boolean
  missing: string[]
}
