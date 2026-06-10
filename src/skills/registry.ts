/**
 * In-memory skill registry — lookup by name or skillKey, policy-aware
 * listing, and model-facing search.
 */

import { resolveSkillKey } from './frontmatter.js'
import type { Skill, SkillFilter } from './types.js'

export class SkillRegistry {
  private readonly skills = new Map<string, Skill>()

  /** Adds (or replaces) a skill, keyed by its manifest name. */
  add(skill: Skill): void {
    this.skills.set(skill.manifest.name, skill)
  }

  /** Looks a skill up by manifest name, falling back to metadata.skillKey. */
  get(nameOrKey: string): Skill | undefined {
    const byName = this.skills.get(nameOrKey)
    if (byName) return byName
    for (const skill of this.skills.values()) {
      if (resolveSkillKey(skill) === nameOrKey) return skill
    }
    return undefined
  }

  all(): Skill[] {
    return [...this.skills.values()]
  }

  get size(): number {
    return this.skills.size
  }

  list(filter?: SkillFilter): Skill[] {
    return this.all().filter((skill) => {
      if (filter?.invocableOnly && skill.manifest.policy.userInvocable !== true) {
        return false
      }
      if (filter?.alwaysOnly && skill.manifest.metadata?.always !== true) {
        return false
      }
      return true
    })
  }

  /**
   * Case-insensitive substring search over name + description.
   * Skills with `disable-model-invocation` are never surfaced; an empty
   * query returns every model-invocable skill.
   */
  search(query: string): Skill[] {
    const needle = query.trim().toLowerCase()
    return this.all().filter((skill) => {
      if (skill.manifest.policy.disableModelInvocation === true) return false
      if (!needle) return true
      const haystack =
        `${skill.manifest.name} ${skill.manifest.description}`.toLowerCase()
      return haystack.includes(needle)
    })
  }
}
