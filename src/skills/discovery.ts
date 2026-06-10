/**
 * Skill discovery — recursive SKILL.md scan under a root directory.
 * Broken skill files are warned about and skipped, never fatal.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseSkillMarkdown } from './frontmatter.js'
import { SkillRegistry } from './registry.js'
import type { Skill } from './types.js'

/**
 * Recursively scans `rootDir` for files named SKILL.md and parses each.
 * Returns [] when the root directory does not exist; parse/read failures
 * are logged via console.warn and skipped.
 */
export async function discoverSkills(rootDir: string): Promise<Skill[]> {
  let entries
  try {
    entries = await readdir(rootDir, { recursive: true, withFileTypes: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return []
    }
    throw error
  }

  const skillPaths = entries
    .filter((entry) => entry.isFile() && entry.name === 'SKILL.md')
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort()

  const skills: Skill[] = []
  for (const sourcePath of skillPaths) {
    try {
      const raw = await readFile(sourcePath, 'utf8')
      skills.push(parseSkillMarkdown(raw, { sourcePath }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Skipping skill at ${sourcePath}: ${message}`)
    }
  }
  return skills
}

/** Discovers skills under `rootDir` and loads them into a fresh registry. */
export async function loadSkillRegistry(rootDir: string): Promise<SkillRegistry> {
  const registry = new SkillRegistry()
  for (const skill of await discoverSkills(rootDir)) {
    registry.add(skill)
  }
  return registry
}
