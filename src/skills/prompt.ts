/**
 * System-prompt surface for skills — an <available_skills> XML block, in the
 * spirit of OpenClaw's formatSkillsForPrompt (skill-contract.ts).
 */

import type { Skill } from './types.js'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Renders model-invocable skills as an <available_skills> block.
 * Returns '' when nothing is visible to the model.
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  const visible = skills.filter(
    (skill) => skill.manifest.policy.disableModelInvocation !== true,
  )
  if (visible.length === 0) {
    return ''
  }
  const lines = ['<available_skills>']
  for (const skill of visible) {
    lines.push('  <skill>')
    lines.push(`    <name>${escapeXml(skill.manifest.name)}</name>`)
    lines.push(
      `    <description>${escapeXml(skill.manifest.description)}</description>`,
    )
    const emoji = skill.manifest.metadata?.emoji
    if (emoji) {
      lines.push(`    <emoji>${escapeXml(emoji)}</emoji>`)
    }
    const homepage = skill.manifest.metadata?.homepage
    if (homepage) {
      lines.push(`    <homepage>${escapeXml(homepage)}</homepage>`)
    }
    lines.push('  </skill>')
  }
  lines.push('</available_skills>')
  return lines.join('\n')
}
