/**
 * Skill → ToolDefinition adapter so the LLM can invoke skills as
 * OpenAI-compatible function tools.
 */

import type { ToolDefinition } from '../llm/types.js'
import type { Skill } from './types.js'

const MAX_DESCRIPTION_LENGTH = 1024

function sanitizeToolName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return sanitized.length > 0 ? sanitized : 'skill'
}

/** Wraps one skill as a `skill_<name>` function tool. */
export function skillToTool(skill: Skill): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: `skill_${sanitizeToolName(skill.manifest.name)}`,
      description: skill.manifest.description.slice(0, MAX_DESCRIPTION_LENGTH),
      parameters: {
        type: 'object',
        properties: {
          args: {
            type: 'string',
            description: 'Arguments or request details for the skill',
          },
        },
        required: [],
      },
    },
  }
}

/** Adapts every model-invocable skill; disabled skills are excluded. */
export function skillsToTools(skills: Skill[]): ToolDefinition[] {
  return skills
    .filter((skill) => skill.manifest.policy.disableModelInvocation !== true)
    .map((skill) => skillToTool(skill))
}
