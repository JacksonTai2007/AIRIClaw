import { spawn } from 'node:child_process'
import type { PrereqCheckResult, SkillDefinition, SkillResult } from '@airiclaw/types'

export interface ExecuteOptions {
  skipPrereqCheck?: boolean
}

export class SkillExecutor {
  private readonly binaryCache = new Map<string, boolean>()

  async checkPrerequisites(skill: SkillDefinition): Promise<PrereqCheckResult> {
    const bins = skill.manifest.bins ?? []
    const results = await Promise.all(bins.map(bin => this.hasBinary(bin)))
    const missing = bins.filter((_, i) => !results[i])
    return { satisfied: missing.length === 0, missing }
  }

  async execute(
    skill: SkillDefinition,
    input: Record<string, unknown>,
    options: ExecuteOptions = {},
  ): Promise<SkillResult> {
    const start = Date.now()
    if (!options.skipPrereqCheck) {
      const prereq = await this.checkPrerequisites(skill)
      if (!prereq.satisfied) {
        return {
          ok: false,
          error: `Missing required binaries: ${prereq.missing.join(', ')}`,
          durationMs: Date.now() - start,
        }
      }
    }
    return {
      ok: true,
      output: renderPlan(skill, input),
      durationMs: Date.now() - start,
    }
  }

  private async hasBinary(name: string): Promise<boolean> {
    const cached = this.binaryCache.get(name)
    if (cached !== undefined) return cached
    const found = await detectBinary(name)
    this.binaryCache.set(name, found)
    return found
  }
}

function renderPlan(skill: SkillDefinition, input: Record<string, unknown>): string {
  const lines: string[] = [`# Skill: ${skill.manifest.name}`]
  if (skill.manifest.description) lines.push(skill.manifest.description, '')
  lines.push('## Input', '```json', JSON.stringify(input, null, 2), '```', '')
  if (skill.workflow.length) {
    lines.push('## Workflow')
    for (const step of skill.workflow) {
      lines.push(`${step.order}. ${step.description}`)
      if (step.commands?.length) lines.push('```', ...step.commands, '```')
    }
    lines.push('')
  }
  if (skill.guardrails.length) {
    lines.push('## Guardrails')
    for (const g of skill.guardrails) lines.push(`- ${g}`)
  }
  return lines.join('\n')
}

function detectBinary(name: string): Promise<boolean> {
  const cmd = process.platform === 'win32' ? 'where' : 'which'
  return new Promise<boolean>((resolve) => {
    const child = spawn(cmd, [name], { stdio: 'ignore' })
    child.on('error', () => resolve(false))
    child.on('close', code => resolve(code === 0))
  })
}
