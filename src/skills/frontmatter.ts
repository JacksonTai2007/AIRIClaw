/**
 * SKILL.md frontmatter parsing — gray-matter split plus the OpenClaw
 * `metadata.openclaw` block (always/emoji/homepage/skillKey/primaryEnv/os/
 * requires/install), matching upstream 2026.6.2 defaults:
 * `user-invocable` defaults to true, `disable-model-invocation` to false.
 */

import path from 'node:path'
import matter from 'gray-matter'
import type {
  Skill,
  SkillInstallSpec,
  SkillMetadata,
  SkillRequires,
} from './types.js'

const INSTALL_KINDS = new Set<SkillInstallSpec['kind']>([
  'brew',
  'node',
  'go',
  'uv',
  'download',
])

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function asBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', '1', 'on'].includes(normalized)) return true
    if (['false', 'no', '0', 'off'].includes(normalized)) return false
  }
  return undefined
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => entry !== undefined)
  return items.length > 0 ? items : undefined
}

/** Boolean coercion with an upstream-style fallback (parseFrontmatterBool). */
function parseBool(value: unknown, fallback: boolean): boolean {
  return asBool(value) ?? fallback
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return undefined
}

function parseInstallSpec(input: unknown): SkillInstallSpec | undefined {
  const raw = asRecord(input)
  if (!raw) return undefined
  const kind = asString(raw.kind)
  if (!kind || !INSTALL_KINDS.has(kind as SkillInstallSpec['kind'])) {
    // Unsupported installer (e.g. apt) — skip the entry, keep the skill.
    return undefined
  }
  const spec: SkillInstallSpec = {
    id: asString(raw.id) ?? kind,
    kind: kind as SkillInstallSpec['kind'],
  }
  const label = asString(raw.label)
  if (label) spec.label = label
  const os = asStringArray(raw.os)
  if (os) spec.os = os
  const formula = asString(raw.formula)
  if (formula) spec.formula = formula
  const pkg = asString(raw.package)
  if (pkg) spec.package = pkg
  const moduleSpec = asString(raw.module)
  if (moduleSpec) spec.module = moduleSpec
  const url = asString(raw.url)
  if (url) spec.url = url
  const bins = asStringArray(raw.bins)
  if (bins) spec.bins = bins
  return spec
}

function parseRequires(input: unknown): SkillRequires | undefined {
  const raw = asRecord(input)
  if (!raw) return undefined
  const requires: SkillRequires = {}
  const bins = asStringArray(raw.bins)
  if (bins) requires.bins = bins
  const env = asStringArray(raw.env)
  if (env) requires.env = env
  return Object.keys(requires).length > 0 ? requires : undefined
}

/**
 * Resolves the OpenClaw metadata block from frontmatter data.
 * Reads `data.metadata?.openclaw ?? data.metadata`; returns undefined when
 * the block is absent or not an object. A top-level `homepage` field is
 * promoted into the block when it lacks its own.
 */
export function resolveOpenClawMetadata(
  data: Record<string, unknown>,
): SkillMetadata | undefined {
  const metadataRaw = asRecord(data.metadata)
  const block = asRecord(metadataRaw?.openclaw) ?? metadataRaw
  if (!block) return undefined

  const metadata: SkillMetadata = {}
  const always = asBool(block.always)
  if (always !== undefined) metadata.always = always
  const emoji = asString(block.emoji)
  if (emoji) metadata.emoji = emoji
  const homepage = asString(block.homepage)
  if (homepage) metadata.homepage = homepage
  const skillKey = asString(block.skillKey)
  if (skillKey) metadata.skillKey = skillKey
  const primaryEnv = asString(block.primaryEnv)
  if (primaryEnv) metadata.primaryEnv = primaryEnv
  const os = asStringArray(block.os)
  if (os) metadata.os = os
  const requires = parseRequires(block.requires)
  if (requires) metadata.requires = requires
  if (Array.isArray(block.install)) {
    const install = block.install
      .map((entry) => parseInstallSpec(entry))
      .filter((entry): entry is SkillInstallSpec => entry !== undefined)
    if (install.length > 0) metadata.install = install
  }

  // Promote a top-level `homepage` when the block lacks one (gifgrep-style).
  if (!metadata.homepage) {
    const topLevelHomepage = asString(data.homepage)
    if (topLevelHomepage) metadata.homepage = topLevelHomepage
  }

  return metadata
}

function inferNameFromPath(sourcePath: string): string | undefined {
  const dir = path.dirname(sourcePath)
  const base = path.basename(dir)
  if (!base || base === '.' || base === '..' || base === path.sep) {
    return undefined
  }
  return base
}

/** Parses a SKILL.md document into a Skill. Throws when no name resolves. */
export function parseSkillMarkdown(
  raw: string,
  opts: { sourcePath: string },
): Skill {
  const { sourcePath } = opts
  const parsed = matter(raw)
  const data = (parsed.data ?? {}) as Record<string, unknown>

  const name = asString(data.name) ?? inferNameFromPath(sourcePath)
  if (!name) {
    throw new Error(
      `Skill at ${sourcePath} has no name: add a \`name\` frontmatter field ` +
        `or place SKILL.md inside a named directory (e.g. skills/foo/SKILL.md)`,
    )
  }

  const description = asString(data.description) ?? ''
  const userInvocable = parseBool(
    data['user-invocable'] ?? data.userInvocable,
    true,
  )
  const disableModelInvocation = parseBool(
    data['disable-model-invocation'] ?? data.disableModelInvocation,
    false,
  )

  return {
    manifest: {
      name,
      description,
      policy: { userInvocable, disableModelInvocation },
      metadata: resolveOpenClawMetadata(data),
    },
    instructions: parsed.content.trim(),
    sourcePath,
    baseDir: path.dirname(sourcePath),
    raw,
  }
}

/** Canonical registry key: explicit `metadata.skillKey`, else the name. */
export function resolveSkillKey(skill: Skill): string {
  return skill.manifest.metadata?.skillKey ?? skill.manifest.name
}
