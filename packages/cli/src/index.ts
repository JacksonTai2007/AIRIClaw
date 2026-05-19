import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { Command } from 'commander'
import chalk from 'chalk'
import { AIRIClawBridge, loadConfigFromFile, withDefaults } from '@airiclaw/core'
import { BRIDGE_EVENTS } from '@airiclaw/types'
import { SkillBridge } from '@airiclaw/skill-bridge'

async function withSkillBridge<T>(fn: (bridge: SkillBridge) => Promise<T>): Promise<T> {
  const config = await loadConfigFromFile()
  const bridge = new SkillBridge({ skillsPath: config.openclawSkillsPath })
  await bridge.start()
  try {
    return await fn(bridge)
  }
  finally {
    await bridge.stop()
  }
}

const program = new Command()
  .name('airiclaw')
  .description('Local-first bridge between Project AIRI and OpenClaw')
  .version('0.1.0')

program
  .command('start')
  .description('Start the AIRIClaw bridge')
  .option('--watch', 'Watch skills directory for changes', false)
  .action(async (options: { watch: boolean }) => {
    const config = await loadConfigFromFile()
    const bridge = new AIRIClawBridge(config)
    bridge.register(new SkillBridge({
      skillsPath: config.openclawSkillsPath,
      events: bridge.events,
      watch: options.watch,
    }))

    bridge.events.on(BRIDGE_EVENTS.SKILL_LOADED, (e) => {
      console.log(chalk.green(`Loaded ${(e.payload as { count: number }).count} skills`))
    })

    await bridge.start()
    console.log(chalk.cyan('AIRIClaw bridge started. Press Ctrl+C to stop.'))

    const shutdown = async () => {
      console.log(chalk.yellow('\nShutting down...'))
      await bridge.stop()
      process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  })

const skills = program.command('skills').description('Manage OpenClaw skills')

skills
  .command('list')
  .description('List all discovered skills')
  .action(() => withSkillBridge(async (bridge) => {
    const all = bridge.registry.list()
    if (all.length === 0) {
      console.log(chalk.yellow(`No skills found at ${bridge.discovery.skillsPath}`))
      return
    }
    console.log(chalk.cyan(`Found ${all.length} skills:`))
    for (const skill of all) {
      const emoji = skill.manifest.emoji ? `${skill.manifest.emoji} ` : ''
      console.log(`  ${emoji}${chalk.bold(skill.manifest.name)} — ${skill.manifest.description}`)
    }
  }))

skills
  .command('search <query>')
  .description('Search skills by name, tag, or description')
  .action((query: string) => withSkillBridge(async (bridge) => {
    const results = bridge.registry.search(query)
    if (results.length === 0) {
      console.log(chalk.yellow(`No skills match "${query}"`))
      return
    }
    for (const skill of results) {
      console.log(`  ${chalk.bold(skill.manifest.name)} — ${skill.manifest.description}`)
    }
  }))

skills
  .command('show <name>')
  .description('Show the MCP tool definition for a skill')
  .action((name: string) => withSkillBridge(async (bridge) => {
    const skill = bridge.registry.get(name)
    if (!skill) {
      console.log(chalk.red(`Skill "${name}" not found`))
      process.exitCode = 1
      return
    }
    console.log(JSON.stringify(bridge.adapter.adapt(skill), null, 2))
  }))

program
  .command('config init')
  .description('Generate a default airiclaw.config.json')
  .action(async () => {
    const path = resolve(process.cwd(), 'airiclaw.config.json')
    if (existsSync(path)) {
      console.log(chalk.yellow(`${path} already exists`))
      return
    }
    await writeFile(path, JSON.stringify(withDefaults(), null, 2) + '\n', 'utf8')
    console.log(chalk.green(`Wrote ${path}`))
  })

program
  .command('status')
  .description('Show resolved configuration and paths')
  .action(async () => {
    const config = await loadConfigFromFile()
    console.log(chalk.cyan('Resolved configuration:'))
    console.log(JSON.stringify(config, null, 2))
  })

program.parseAsync().catch((err) => {
  console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`))
  process.exit(1)
})
