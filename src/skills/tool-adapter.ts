/**
 * Adapt skills into callable LLM tools. Each skill becomes a function tool named
 * `skill_<sanitized-name>` that accepts a free-form `args` string.
 */

import type { ToolDefinition } from '../llm/types.js'
import type { Skill } from './types.js'

const MAX_DESCRIPTION_LENGTH = 1024

/**
 * Sanitize a skill name into a tool-name-safe slug: lowercase, non-alphanumeric
 * runs collapsed to a single `_`, trimmed of leading/trailing `_`. Falls back to
 * `skill` when nothing usable remains.
 */
function sanitizeName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug.length > 0 ? slug : 'skill'
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max)
}

/** Convert a single skill into a {@link ToolDefinition}. */
export function skillToTool(skill: Skill): ToolDefinition {
  const m = skill.manifest
  return {
    type: 'function',
    function: {
      name: `skill_${sanitizeName(m.name)}`,
      description: truncate(m.description ?? '', MAX_DESCRIPTION_LENGTH),
      parameters: {
        type: 'object',
        properties: {
          args: {
            type: 'string',
            description: 'Arguments / request for the skill',
          },
        },
        required: [],
      },
    },
  }
}

/** Convert all model-invocable skills into tool definitions. */
export function skillsToTools(skills: Skill[]): ToolDefinition[] {
  return skills
    .filter((s) => s.manifest.disableModelInvocation !== true)
    .map(skillToTool)
}
