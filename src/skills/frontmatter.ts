/**
 * Parse a SKILL.md document into a structured {@link Skill}.
 *
 * Uses gray-matter to split YAML/JSON frontmatter from the markdown body. The
 * OpenClaw schema nests its fields under `metadata.openclaw`, but we also accept
 * `metadata` directly or top-level keys as fallbacks. Both kebab-case and
 * camelCase invocation flags are honoured.
 */

import { dirname, basename } from 'node:path'
import matter from 'gray-matter'
import type {
  Skill,
  SkillManifest,
  SkillMetadata,
  SkillInstallSpec,
  SkillRequires,
} from './types.js'

/** Coerce an unknown value into a trimmed non-empty string, else undefined. */
function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return undefined
}

/** Coerce an unknown value into a boolean, accepting common string forms. */
function asBool(value: unknown, fallback?: boolean): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'true' || v === 'yes' || v === '1') return true
    if (v === 'false' || v === 'no' || v === '0') return false
  }
  return fallback
}

/** Coerce an unknown value into an array of trimmed non-empty strings. */
function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const out = value.map(asString).filter((s): s is string => s !== undefined)
    return out.length > 0 ? out : undefined
  }
  const single = asString(value)
  return single ? [single] : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Locate the OpenClaw metadata block. Real OpenClaw nests fields under
 * `metadata.openclaw`; we fall back to `metadata` and finally the root object.
 */
function resolveOpenClawMetadata(data: Record<string, unknown>): Record<string, unknown> {
  const metadata = isRecord(data.metadata) ? data.metadata : undefined
  const openclaw = metadata && isRecord(metadata.openclaw) ? metadata.openclaw : undefined
  return openclaw ?? metadata ?? data
}

function parseRequires(value: unknown): SkillRequires | undefined {
  if (!isRecord(value)) return undefined
  const bins = asStringArray(value.bins)
  const env = asStringArray(value.env)
  if (!bins && !env) return undefined
  const requires: SkillRequires = {}
  if (bins) requires.bins = bins
  if (env) requires.env = env
  return requires
}

const INSTALL_KINDS: ReadonlyArray<SkillInstallSpec['kind']> = [
  'brew',
  'node',
  'go',
  'uv',
  'download',
]

function parseInstallSpec(value: unknown): SkillInstallSpec | undefined {
  if (!isRecord(value)) return undefined
  const kindRaw = asString(value.kind)
  if (!kindRaw || !INSTALL_KINDS.includes(kindRaw as SkillInstallSpec['kind'])) {
    return undefined
  }
  const kind = kindRaw as SkillInstallSpec['kind']
  const id = asString(value.id) ?? kind
  const spec: SkillInstallSpec = { id, kind }

  const label = asString(value.label)
  if (label) spec.label = label
  const os = asStringArray(value.os)
  if (os) spec.os = os
  const formula = asString(value.formula)
  if (formula) spec.formula = formula
  const pkg = asString(value.package)
  if (pkg) spec.package = pkg
  const moduleSpec = asString(value.module)
  if (moduleSpec) spec.module = moduleSpec
  const url = asString(value.url)
  if (url) spec.url = url
  const archive = asString(value.archive)
  if (archive) spec.archive = archive
  const extract = asBool(value.extract)
  if (extract !== undefined) spec.extract = extract
  if (typeof value.stripComponents === 'number') spec.stripComponents = value.stripComponents
  const targetDir = asString(value.targetDir)
  if (targetDir) spec.targetDir = targetDir
  const bins = asStringArray(value.bins)
  if (bins) spec.bins = bins

  return spec
}

function parseInstall(value: unknown): SkillInstallSpec[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out = value
    .map(parseInstallSpec)
    .filter((s): s is SkillInstallSpec => s !== undefined)
  return out.length > 0 ? out : undefined
}

function buildMetadata(oc: Record<string, unknown>): SkillMetadata | undefined {
  const metadata: SkillMetadata = {}
  const emoji = asString(oc.emoji)
  if (emoji) metadata.emoji = emoji
  const always = asBool(oc.always)
  if (always !== undefined) metadata.always = always
  const homepage = asString(oc.homepage)
  if (homepage) metadata.homepage = homepage
  const skillKey = asString(oc.skillKey ?? oc['skill-key'])
  if (skillKey) metadata.skillKey = skillKey
  const primaryEnv = asString(oc.primaryEnv ?? oc['primary-env'])
  if (primaryEnv) metadata.primaryEnv = primaryEnv
  const os = asStringArray(oc.os)
  if (os) metadata.os = os
  const requires = parseRequires(oc.requires)
  if (requires) metadata.requires = requires
  const install = parseInstall(oc.install)
  if (install) metadata.install = install

  return Object.keys(metadata).length > 0 ? metadata : undefined
}

/** Infer a skill name from the parent directory of its SKILL.md path. */
function inferNameFromPath(sourcePath: string): string | undefined {
  const dir = dirname(sourcePath)
  const name = basename(dir)
  if (!name || name === '.' || name === '/' || name === '') return undefined
  return name
}

/**
 * Parse a raw SKILL.md string into a {@link Skill}.
 *
 * @throws if a skill name can be resolved neither from frontmatter nor the path.
 */
export function parseSkillMarkdown(raw: string, opts: { sourcePath: string }): Skill {
  const parsed = matter(raw)
  const data = isRecord(parsed.data) ? parsed.data : {}
  const oc = resolveOpenClawMetadata(data)

  const homepageTop = asString(data.homepage)
  const name = asString(data.name) ?? inferNameFromPath(opts.sourcePath)
  if (!name) {
    throw new Error(
      `Unable to resolve skill name for ${opts.sourcePath}: missing frontmatter \`name\` and indeterminable directory name`,
    )
  }

  const description = asString(data.description) ?? ''

  const userInvocable = asBool(data['user-invocable'] ?? data.userInvocable)
  const disableModelInvocation = asBool(
    data['disable-model-invocation'] ?? data.disableModelInvocation,
  )

  const metadata = buildMetadata(oc)
  // Honour a top-level homepage if the openclaw block did not supply one.
  if (homepageTop && !(metadata && metadata.homepage)) {
    const m = metadata ?? {}
    m.homepage = homepageTop
    return finalize(name, description, userInvocable, disableModelInvocation, m, parsed.content, raw, opts.sourcePath)
  }

  return finalize(name, description, userInvocable, disableModelInvocation, metadata, parsed.content, raw, opts.sourcePath)
}

function finalize(
  name: string,
  description: string,
  userInvocable: boolean | undefined,
  disableModelInvocation: boolean | undefined,
  metadata: SkillMetadata | undefined,
  content: string,
  raw: string,
  sourcePath: string,
): Skill {
  const manifest: SkillManifest = { name, description }
  if (userInvocable !== undefined) manifest.userInvocable = userInvocable
  if (disableModelInvocation !== undefined) {
    manifest.disableModelInvocation = disableModelInvocation
  }
  if (metadata) manifest.metadata = metadata

  return {
    manifest,
    instructions: content.trim(),
    sourcePath,
    baseDir: dirname(sourcePath),
    raw,
  }
}
