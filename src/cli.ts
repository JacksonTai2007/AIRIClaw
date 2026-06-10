#!/usr/bin/env node
/**
 * AIRIClaw CLI.
 *
 *   airiclaw chat [message]      one-shot, or interactive REPL if no message
 *   airiclaw skills list [-i]    list discovered skills (-i = user-invocable only)
 *   airiclaw skills search <q>   search model-invocable skills
 *   airiclaw serve [--port N]    start the gateway server (protocol v4)
 *   airiclaw config init         write .airiclaw/config.json from a template
 *   airiclaw status              print resolved config + provider info
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { configTemplate, loadConfig } from './config/index.js'
import { DEFAULT_CHARACTER, loadCharacterCard, type CharacterCard } from './character/index.js'
import { loadSkillRegistry } from './skills/index.js'
import { Assistant } from './runtime/index.js'
import { GATEWAY_DEFAULT_PORT, GatewayServer } from './gateway/index.js'
import { DEEPSEEK_DEFAULTS } from './llm/index.js'

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2)
  switch (command) {
    case 'chat':
      return cmdChat(rest)
    case 'skills':
      return cmdSkills(rest)
    case 'serve':
      return cmdServe(rest)
    case 'config':
      return cmdConfig(rest)
    case 'status':
      return cmdStatus()
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      return printHelp()
    default:
      console.error(`Unknown command: ${command}\n`)
      printHelp()
      process.exitCode = 1
  }
}

async function loadCharacter(path?: string): Promise<CharacterCard> {
  if (!path) return DEFAULT_CHARACTER
  try {
    return loadCharacterCard(JSON.parse(await readFile(path, 'utf8')))
  } catch (error) {
    console.error(`Failed to load character card at ${path}: ${(error as Error).message}`)
    return DEFAULT_CHARACTER
  }
}

async function buildAssistant(): Promise<Assistant> {
  const config = await loadConfig()
  const character = await loadCharacter(config.characterPath)
  const assistant = new Assistant({ config, character })
  const count = await assistant.loadSkills()
  if (count > 0) console.error(`[airiclaw] loaded ${count} skill(s)`)
  if (!config.llm.apiKey) {
    console.error('[airiclaw] warning: no DEEPSEEK_API_KEY set — LLM calls will fail.')
  }
  return assistant
}

async function cmdChat(args: string[]): Promise<void> {
  const assistant = await buildAssistant()
  const message = args.join(' ').trim()

  assistant.events.on('output:gen-ai:chat:delta', ({ delta }) => {
    stdout.write(delta)
  })

  if (message) {
    await assistant.chat(message)
    stdout.write('\n')
    return
  }

  const rl = createInterface({ input: stdin, output: stdout })
  const greeting = assistant.character.greetings[0]
  console.log(`${greeting ?? `${assistant.character.name} is ready.`} (type 'exit' to quit)\n`)
  try {
    for (;;) {
      const line = (await rl.question('you › ')).trim()
      if (line === 'exit' || line === 'quit') break
      if (!line) continue
      stdout.write(`${assistant.character.name} › `)
      await assistant.chat(line)
      stdout.write('\n\n')
    }
  } finally {
    rl.close()
  }
}

async function cmdSkills(args: string[]): Promise<void> {
  const config = await loadConfig()
  const registry = await loadSkillRegistry(config.skillsDir).catch(() => null)
  if (!registry || registry.size === 0) {
    console.log(`No skills found under ${config.skillsDir}`)
    return
  }
  const [sub, ...subArgs] = args
  if (sub === 'search') {
    const query = subArgs.join(' ')
    const hits = registry.search(query)
    console.log(`${hits.length} skill(s) matching "${query}":`)
    for (const s of hits) printSkillLine(s.manifest.metadata?.emoji, s.manifest.name, s.manifest.description)
    return
  }
  const invocableOnly = args.includes('-i') || args.includes('--invocable')
  const skills = registry.list({ invocableOnly })
  console.log(`${skills.length} skill(s)${invocableOnly ? ' (user-invocable)' : ''}:`)
  for (const s of skills) printSkillLine(s.manifest.metadata?.emoji, s.manifest.name, s.manifest.description)
}

function printSkillLine(emoji: string | undefined, name: string, description: string): void {
  console.log(`  ${emoji ?? '•'} ${name} — ${description}`)
}

async function cmdServe(args: string[]): Promise<void> {
  const config = await loadConfig()
  const portFlag = args.indexOf('--port')
  const port = portFlag >= 0 ? Number(args[portFlag + 1]) : config.gatewayPort
  const assistant = await buildAssistant()
  const server = new GatewayServer({ port, bus: assistant.events })

  server.register('chat', async (params) => {
    const { text, sessionId } = (params ?? {}) as { text?: string; sessionId?: string }
    if (!text) throw new Error('chat requires { text }')
    const result = await assistant.chat(text, sessionId)
    return { text: result.text }
  })
  server.register('ping', () => ({ pong: true }))

  await server.start()
  console.error(`[airiclaw] gateway listening on ws://localhost:${port} (protocol v4)`)
  console.error('[airiclaw] press Ctrl+C to stop')

  const shutdown = async () => {
    console.error('\n[airiclaw] shutting down…')
    await server.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

async function cmdConfig(args: string[]): Promise<void> {
  if (args[0] !== 'init') {
    console.error('Usage: airiclaw config init')
    process.exitCode = 1
    return
  }
  const dir = resolve(process.cwd(), '.airiclaw')
  const path = resolve(dir, 'config.json')
  await mkdir(dir, { recursive: true })
  await writeFile(path, configTemplate() + '\n', { flag: 'wx' }).then(
    () => console.log(`Wrote ${path}`),
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'EEXIST') console.log(`${path} already exists — leaving it untouched.`)
      else throw error
    },
  )
}

async function cmdStatus(): Promise<void> {
  const config = await loadConfig()
  const character = await loadCharacter(config.characterPath)
  console.log('AIRIClaw status')
  console.log('─'.repeat(40))
  console.log(`Character     : ${character.name} v${character.version}`)
  console.log(`Provider      : ${config.llm.provider}`)
  console.log(`Model         : ${config.llm.model}`)
  console.log(`Base URL      : ${config.llm.baseURL ?? DEEPSEEK_DEFAULTS.BASE_URL}`)
  console.log(`Thinking mode : ${config.llm.thinkingMode ?? DEEPSEEK_DEFAULTS.THINKING_MODE}`)
  console.log(`Max context   : ${DEEPSEEK_DEFAULTS.MAX_CONTEXT.toLocaleString()} tokens`)
  console.log(`API key       : ${config.llm.apiKey ? 'set' : 'NOT set (set DEEPSEEK_API_KEY)'}`)
  console.log(`Skills dir    : ${config.skillsDir}`)
  console.log(`Memory dir    : ${config.memoryDir}`)
  console.log(`Gateway port  : ${config.gatewayPort}`)
}

function printHelp(): void {
  console.log(`AIRIClaw — Agent + digital-human assistant (DeepSeek V4 Pro)

Usage:
  airiclaw chat [message]       Chat one-shot, or start an interactive REPL
  airiclaw skills list [-i]     List discovered skills (-i: user-invocable only)
  airiclaw skills search <q>    Search model-invocable skills
  airiclaw serve [--port N]     Start the gateway server (default :${GATEWAY_DEFAULT_PORT})
  airiclaw config init          Write .airiclaw/config.json from a template
  airiclaw status               Print resolved config + provider info

Environment:
  DEEPSEEK_API_KEY              DeepSeek API key (required for LLM calls)
  AIRICLAW_MODEL                Override model (default ${DEEPSEEK_DEFAULTS.MODEL_PRO})
  AIRICLAW_THINKING_MODE        non_think | think_high | think_max
  AIRICLAW_GATEWAY_PORT         Override gateway port
`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
