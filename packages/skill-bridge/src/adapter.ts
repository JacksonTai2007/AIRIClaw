import type { MCPToolDefinition, SkillDefinition } from '@airiclaw/types'

const MCP_NAME_RE = /[^a-zA-Z0-9_-]+/g

export class SkillToMCPAdapter {
  adapt(skill: SkillDefinition): MCPToolDefinition {
    return {
      name: this.toMCPName(skill.manifest.name),
      description: this.buildDescription(skill),
      inputSchema: this.buildInputSchema(skill),
      source: 'openclaw-skill',
      skillName: skill.manifest.name,
    }
  }

  adaptAll(skills: SkillDefinition[]): MCPToolDefinition[] {
    return skills.map(skill => this.adapt(skill))
  }

  private toMCPName(name: string): string {
    return name.replace(MCP_NAME_RE, '_').slice(0, 64) || 'skill'
  }

  private buildDescription(skill: SkillDefinition): string {
    const parts: string[] = []
    if (skill.manifest.description) parts.push(skill.manifest.description)
    if (skill.manifest.bins?.length) {
      parts.push(`Requires: ${skill.manifest.bins.join(', ')}`)
    }
    if (skill.workflow.length) {
      const preview = skill.workflow
        .slice(0, 3)
        .map(s => `${s.order}. ${s.description}`)
        .join(' | ')
      parts.push(`Workflow: ${preview}`)
    }
    return parts.join(' — ')
  }

  private buildInputSchema(skill: SkillDefinition): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: `Input or instruction for the "${skill.manifest.name}" skill`,
        },
        args: {
          type: 'object',
          description: 'Optional structured arguments',
          additionalProperties: true,
        },
      },
      required: ['query'],
      additionalProperties: false,
    }
  }
}
