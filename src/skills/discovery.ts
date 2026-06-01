/**
 * Filesystem discovery of SKILL.md files. Recursively walks a root directory,
 * parses each SKILL.md, and (for the registry variant) assembles a
 * {@link SkillRegistry}. Parse failures are logged and skipped, never thrown.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseSkillMarkdown } from './frontmatter.js'
import { SkillRegistry } from './registry.js'
import type { Skill } from './types.js'

const SKILL_FILENAME = 'SKILL.md'

/** Recursively collect absolute paths to every SKILL.md beneath `rootDir`. */
async function findSkillFiles(rootDir: string): Promise<string[]> {
  const found: string[] = []
  let entries
  try {
    entries = await readdir(rootDir, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    const full = join(rootDir, entry.name)
    if (entry.isDirectory()) {
      found.push(...(await findSkillFiles(full)))
    } else if (entry.isFile() && entry.name === SKILL_FILENAME) {
      found.push(full)
    }
  }
  return found
}

/**
 * Discover and parse every SKILL.md beneath `rootDir`. Skills that fail to parse
 * are reported via console.warn and omitted from the result.
 */
export async function discoverSkills(rootDir: string): Promise<Skill[]> {
  const files = await findSkillFiles(rootDir)
  const skills: Skill[] = []
  for (const sourcePath of files) {
    try {
      const raw = await readFile(sourcePath, 'utf8')
      skills.push(parseSkillMarkdown(raw, { sourcePath }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[skills] Skipping ${sourcePath}: ${message}`)
    }
  }
  return skills
}

/** Build a {@link SkillRegistry} from all skills discovered beneath `rootDir`. */
export async function loadSkillRegistry(rootDir: string): Promise<SkillRegistry> {
  const registry = new SkillRegistry()
  for (const skill of await discoverSkills(rootDir)) {
    registry.add(skill)
  }
  return registry
}
