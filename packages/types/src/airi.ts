export interface AiriProtocolEvents {
  'input:text': { text: string; sessionId?: string }
  'input:text:voice': { text: string; audioRef?: string }
  'input:voice': { audio: ArrayBuffer; format?: string }
  'output:gen-ai:chat:message': { content: string; role: string }
  'output:gen-ai:chat:tool-call': { toolName: string; args: Record<string, unknown> }
  'output:gen-ai:chat:complete': { sessionId: string; usage?: Record<string, number> }
  'spark:notify': { message: string; level?: 'info' | 'warn' | 'error' }
  'spark:emit': { event: string; data: unknown }
  'spark:command': { command: string; guidance?: SparkCommandGuidance }
  'context:update': { key: string; value: unknown; metadata?: Record<string, unknown> }
  'module:announce': { moduleId: string; capabilities: string[] }
  'module:status:change': { moduleId: string; phase: ModulePhase }
}

export interface SparkCommandGuidance {
  description: string
  options?: SparkCommandGuidanceOption[]
}

export interface SparkCommandGuidanceOption {
  label: string
  value: string
}

export type ModulePhase =
  | 'announced'
  | 'preparing'
  | 'prepared'
  | 'configuration-needed'
  | 'configured'
  | 'ready'
  | 'failed'
