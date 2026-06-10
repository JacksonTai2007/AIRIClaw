/** Skills module barrel. */

export type {
  Skill,
  SkillFilter,
  SkillInstallSpec,
  SkillInvocationPolicy,
  SkillManifest,
  SkillMetadata,
  SkillRequires,
} from './types.js'
export { parseSkillMarkdown, resolveOpenClawMetadata, resolveSkillKey } from './frontmatter.js'
export { SkillRegistry } from './registry.js'
export { discoverSkills, loadSkillRegistry } from './discovery.js'
export { formatSkillsForPrompt } from './prompt.js'
export { skillToTool, skillsToTools } from './tool-adapter.js'
