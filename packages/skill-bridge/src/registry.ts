import type { SkillDefinition, SkillFilter } from '@airiclaw/types'

export class SkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>()
  private readonly byPath = new Map<string, string>()

  register(skill: SkillDefinition): void {
    const existing = this.skills.get(skill.manifest.name)
    if (existing && existing.sourcePath !== skill.sourcePath) {
      this.byPath.delete(existing.sourcePath)
    }
    this.skills.set(skill.manifest.name, skill)
    this.byPath.set(skill.sourcePath, skill.manifest.name)
  }

  registerAll(skills: SkillDefinition[]): void {
    for (const skill of skills) this.register(skill)
  }

  unregister(name: string): boolean {
    const skill = this.skills.get(name)
    if (!skill) return false
    this.byPath.delete(skill.sourcePath)
    return this.skills.delete(name)
  }

  unregisterByPath(sourcePath: string): boolean {
    const name = this.byPath.get(sourcePath)
    if (!name) return false
    return this.unregister(name)
  }

  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name)
  }

  getByPath(sourcePath: string): SkillDefinition | undefined {
    const name = this.byPath.get(sourcePath)
    return name ? this.skills.get(name) : undefined
  }

  has(name: string): boolean {
    return this.skills.has(name)
  }

  size(): number {
    return this.skills.size
  }

  list(filter?: SkillFilter): SkillDefinition[] {
    const all = [...this.skills.values()]
    if (!filter) return all
    return all.filter((s) => {
      if (filter.kind && s.manifest.kind !== filter.kind) return false
      if (filter.tag && !s.manifest.tags?.includes(filter.tag)) return false
      if (filter.invocableOnly && !s.manifest['user-invocable']) return false
      if (filter.search && score(s, filter.search.toLowerCase()) === 0) return false
      return true
    })
  }

  search(query: string, limit = 20): SkillDefinition[] {
    const q = query.toLowerCase().trim()
    if (!q) return []
    return [...this.skills.values()]
      .filter(s => !s.manifest.hidden)
      .map(skill => ({ skill, score: score(skill, q) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score || a.skill.manifest.name.localeCompare(b.skill.manifest.name))
      .slice(0, limit)
      .map(r => r.skill)
  }

  clear(): void {
    this.skills.clear()
    this.byPath.clear()
  }
}

function score(skill: SkillDefinition, q: string): number {
  const name = skill.manifest.name.toLowerCase()
  const desc = (skill.manifest.description ?? '').toLowerCase()
  const tags = skill.manifest.tags?.map(t => t.toLowerCase()) ?? []

  if (name === q) return 100
  if (name.startsWith(q)) return 80
  if (name.includes(q)) return 60
  if (tags.includes(q)) return 50
  if (desc.includes(q)) return 20
  return 0
}
