import matter from 'gray-matter'
import type { SkillDefinition, SkillManifest, SkillMetadata, WorkflowStep } from '@airiclaw/types'

export interface ParseOptions {
  sourcePath: string
}

const LIST_ITEM_RE = /^\s*(?:\d+\.|[-*])\s+(.*)$/
const CODE_FENCE_RE = /^\s*```/

export function parseSkillMarkdown(raw: string, options: ParseOptions): SkillDefinition {
  const { data, content } = matter(raw)
  const manifest = normalizeManifest(data, options.sourcePath)

  return {
    manifest,
    instructions: content.trim(),
    workflow: extractWorkflow(content),
    guardrails: extractGuardrails(content),
    references: extractReferences(content),
    sourcePath: options.sourcePath,
  }
}

function normalizeManifest(data: Record<string, unknown>, sourcePath: string): SkillManifest {
  const name = String(data.name ?? inferNameFromPath(sourcePath))
  if (!name) {
    throw new Error(`Skill at ${sourcePath} is missing a name`)
  }
  return {
    name,
    description: String(data.description ?? ''),
    emoji: asString(data.emoji),
    bins: asStringArray(data.bins),
    kind: asString(data.kind),
    label: asString(data.label),
    homepage: asString(data.homepage),
    version: asString(data.version),
    tags: asStringArray(data.tags),
    'user-invocable': asBool(data['user-invocable']),
    hidden: asBool(data.hidden),
    'command-dispatch': data['command-dispatch'] === 'tool' ? 'tool' : undefined,
    'command-tool': asString(data['command-tool']),
    'command-args': asString(data['command-args']),
    metadata: parseMetadata(data.metadata),
  }
}

function parseMetadata(value: unknown): SkillMetadata | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const openclaw = (typeof raw.openclaw === 'object' && raw.openclaw) ? raw.openclaw as Record<string, unknown> : raw
  return {
    emoji: asString(openclaw.emoji),
    'always-eligible': asBool(openclaw['always-eligible']),
    primaryEnv: asString(openclaw.primaryEnv),
    requires: parseRequires(openclaw.requires),
    install: parseInstall(openclaw.install),
  }
}

function parseRequires(value: unknown): SkillMetadata['requires'] {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  return {
    bins: asStringArray(raw.bins),
    env: asStringArray(raw.env),
    config: asStringArray(raw.config),
  }
}

function parseInstall(value: unknown): SkillMetadata['install'] {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  return {
    brew: asString(raw.brew),
    node: asString(raw.node),
    go: asString(raw.go),
    uv: asString(raw.uv),
    download: asString(raw.download),
  }
}

function inferNameFromPath(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 2] ?? ''
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  return undefined
}

function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return value.split(/[,\s]+/).filter(Boolean)
  return undefined
}

interface Section {
  heading: string
  body: string
}

export function splitSections(markdown: string): Section[] {
  const headingRe = /^#{1,6}\s+(.+?)\s*$/gm
  const headings: Array<{ heading: string; index: number; endOfHeading: number }> = []
  let match: RegExpExecArray | null
  while ((match = headingRe.exec(markdown)) !== null) {
    headings.push({
      heading: match[1].trim(),
      index: match.index,
      endOfHeading: match.index + match[0].length,
    })
  }
  return headings.map((current, i) => {
    const next = headings[i + 1]
    return {
      heading: current.heading,
      body: markdown.slice(current.endOfHeading, next?.index ?? markdown.length).trim(),
    }
  })
}

export function findSection(markdown: string, predicate: (heading: string) => boolean): Section | undefined {
  return splitSections(markdown).find(s => predicate(s.heading))
}

export function parseListItems(body: string): string[] {
  return body
    .split('\n')
    .map(line => LIST_ITEM_RE.exec(line)?.[1]?.trim())
    .filter((s): s is string => Boolean(s && s.length))
}

export function extractWorkflow(markdown: string): WorkflowStep[] {
  const section = findSection(markdown, h => /workflow|steps|procedure/i.test(h))
  if (!section) return []

  const steps: WorkflowStep[] = []
  let order = 0
  let inFence = false
  let currentStep: WorkflowStep | undefined

  for (const line of section.body.split('\n')) {
    if (CODE_FENCE_RE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      if (currentStep) {
        currentStep.commands ??= []
        currentStep.commands.push(line)
      }
      continue
    }
    const item = LIST_ITEM_RE.exec(line)?.[1]?.trim()
    if (item) {
      if (currentStep) steps.push(currentStep)
      order += 1
      currentStep = { order, description: item }
    }
  }
  if (currentStep) steps.push(currentStep)
  return steps
}

export function extractGuardrails(markdown: string): string[] {
  const section = findSection(markdown, h => /guardrails?|safety|constraints|do not/i.test(h))
  return section ? parseListItems(section.body) : []
}

export function extractReferences(markdown: string): string[] {
  const section = findSection(markdown, h => /references?|links?|see also/i.test(h))
  return section ? parseListItems(section.body) : []
}
