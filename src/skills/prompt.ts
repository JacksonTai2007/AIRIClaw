/**
 * Render skills into an `<available_skills>` XML block for the system prompt.
 * Mirrors OpenClaw's `formatSkillsForPrompt`: a header explaining how to load a
 * skill, followed by one `<skill>` entry per (non-disabled) skill.
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
 * Produce the `<available_skills>` block. Skills with model invocation disabled
 * are omitted. Returns '' when there are no skills to advertise.
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  const visible = skills.filter((s) => s.manifest.disableModelInvocation !== true)
  if (visible.length === 0) {
    return ''
  }

  const lines: string[] = [
    '\n\nThe following skills provide specialized instructions for specific tasks.',
    "Use the read tool to load a skill's file when the task matches its description.",
    'When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.',
    '',
    '<available_skills>',
  ]

  for (const skill of visible) {
    const m = skill.manifest
    lines.push('  <skill>')
    lines.push(`    <name>${escapeXml(m.name)}</name>`)
    lines.push(`    <description>${escapeXml(m.description)}</description>`)
    if (m.metadata?.emoji) {
      lines.push(`    <emoji>${escapeXml(m.metadata.emoji)}</emoji>`)
    }
    if (m.metadata?.homepage) {
      lines.push(`    <homepage>${escapeXml(m.metadata.homepage)}</homepage>`)
    }
    lines.push(`    <location>${escapeXml(skill.sourcePath)}</location>`)
    lines.push('  </skill>')
  }

  lines.push('</available_skills>')
  return lines.join('\n')
}
