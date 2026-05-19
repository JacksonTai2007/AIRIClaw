import type { BridgeModule, BridgeEventBus } from '@airiclaw/core'
import { BRIDGE_EVENTS, type MCPToolDefinition, type SkillChangeEvent } from '@airiclaw/types'
import { SkillDiscovery } from './discovery.js'
import { SkillRegistry } from './registry.js'
import { SkillToMCPAdapter } from './adapter.js'
import { SkillExecutor } from './executor.js'

export interface SkillBridgeOptions {
  skillsPath: string
  events?: BridgeEventBus
  watch?: boolean
}

export class SkillBridge implements BridgeModule {
  readonly name = 'skill-bridge'
  readonly registry = new SkillRegistry()
  readonly adapter = new SkillToMCPAdapter()
  readonly executor = new SkillExecutor()
  readonly discovery: SkillDiscovery

  private watcher?: { close: () => Promise<void> }

  constructor(private readonly options: SkillBridgeOptions) {
    this.discovery = new SkillDiscovery(options.skillsPath)
  }

  async start(): Promise<void> {
    const skills = await this.discovery.scanSkills()
    this.registry.registerAll(skills)
    this.options.events?.emit(BRIDGE_EVENTS.SKILL_LOADED, { count: skills.length })
    if (this.options.watch) {
      this.watcher = this.discovery.watch(event => this.handleChange(event))
    }
  }

  async stop(): Promise<void> {
    await this.watcher?.close()
    this.watcher = undefined
    this.registry.clear()
  }

  listTools(): MCPToolDefinition[] {
    return this.adapter.adaptAll(this.registry.list())
  }

  private handleChange(event: SkillChangeEvent): void {
    if (event.type === 'removed') {
      if (this.registry.unregisterByPath(event.path)) {
        this.options.events?.emit(BRIDGE_EVENTS.SKILL_REMOVED, { path: event.path })
      }
      return
    }
    if (!event.skill) return
    this.registry.register(event.skill)
    this.options.events?.emit(
      event.type === 'added' ? BRIDGE_EVENTS.SKILL_ADDED : BRIDGE_EVENTS.SKILL_CHANGED,
      { name: event.skill.manifest.name, path: event.path },
    )
  }
}
