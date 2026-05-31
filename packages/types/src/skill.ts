export interface SkillMetadata {
  emoji?: string
  'always-eligible'?: boolean
  primaryEnv?: string
  requires?: {
    bins?: string[]
    env?: string[]
    config?: string[]
  }
  install?: {
    brew?: string
    node?: string
    go?: string
    uv?: string
    download?: string
  }
}

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
  'user-invocable'?: boolean
  hidden?: boolean
  'command-dispatch'?: 'tool'
  'command-tool'?: string
  'command-args'?: string
  metadata?: SkillMetadata
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
  invocableOnly?: boolean
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
