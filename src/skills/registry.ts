/**
 * An in-memory registry of parsed skills, keyed by name.
 *
 * Provides filtered listing (by tag/requires and invocability) plus a
 * model-facing `search` that excludes skills opted out of model invocation.
 */

import type { Skill, SkillFilter } from './types.js'

export class SkillRegistry {
  private readonly skills = new Map<string, Skill>()

  /** Add (or replace by name) a skill. */
  add(skill: Skill): void {
    this.skills.set(skill.manifest.name, skill)
  }

  /** Retrieve a skill by exact name. */
  get(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  /** All registered skills, in insertion order. */
  all(): Skill[] {
    return [...this.skills.values()]
  }

  /** Number of registered skills. */
  get size(): number {
    return this.skills.size
  }

  /**
   * List skills, optionally filtered by a required bin/env tag and/or
   * restricted to user-invocable skills.
   */
  list(filter?: SkillFilter): Skill[] {
    let result = this.all()
    if (filter?.invocableOnly) {
      result = result.filter((s) => s.manifest.userInvocable === true)
    }
    if (filter?.tag) {
      const tag = filter.tag
      result = result.filter((s) => skillMatchesTag(s, tag))
    }
    return result
  }

  /**
   * Case-insensitive substring search over name + description. Excludes skills
   * with `disableModelInvocation === true`, which are not model-discoverable.
   */
  search(query: string): Skill[] {
    const q = query.trim().toLowerCase()
    return this.all().filter((s) => {
      if (s.manifest.disableModelInvocation === true) return false
      if (q.length === 0) return true
      const haystack = `${s.manifest.name} ${s.manifest.description}`.toLowerCase()
      return haystack.includes(q)
    })
  }
}

/** A skill matches a tag if it appears among its required bins, env, or its name. */
function skillMatchesTag(skill: Skill, tag: string): boolean {
  const t = tag.toLowerCase()
  if (skill.manifest.name.toLowerCase() === t) return true
  const requires = skill.manifest.metadata?.requires
  if (requires?.bins?.some((b) => b.toLowerCase() === t)) return true
  if (requires?.env?.some((e) => e.toLowerCase() === t)) return true
  return false
}
