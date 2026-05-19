import { BRIDGE_EVENTS, type BridgeConfig } from '@airiclaw/types'
import { BridgeEventBus } from './event-bus.js'

export interface BridgeModule {
  readonly name: string
  start(): Promise<void>
  stop(): Promise<void>
}

export class AIRIClawBridge {
  private readonly modules: BridgeModule[] = []
  private started = false

  readonly events = new BridgeEventBus()

  constructor(readonly config: BridgeConfig) {}

  register(module: BridgeModule): void {
    if (this.started) {
      throw new Error(`Cannot register module "${module.name}" after bridge has started`)
    }
    this.modules.push(module)
  }

  async start(): Promise<void> {
    if (this.started) return
    for (const module of this.modules) {
      await module.start()
    }
    this.started = true
    this.events.emit(BRIDGE_EVENTS.BRIDGE_STARTED, { modules: this.modules.map(m => m.name) })
  }

  async stop(): Promise<void> {
    if (!this.started) return
    for (const module of [...this.modules].reverse()) {
      await module.stop()
    }
    this.started = false
    this.events.emit(BRIDGE_EVENTS.BRIDGE_STOPPED, { modules: this.modules.map(m => m.name) })
  }

  isStarted(): boolean {
    return this.started
  }
}
