export interface MCPToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  source: 'openclaw-skill'
  skillName: string
}

export interface MCPToolInvocation {
  tool: string
  args: Record<string, unknown>
  sessionKey?: string
}

export interface MCPToolResult {
  ok: boolean
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}
