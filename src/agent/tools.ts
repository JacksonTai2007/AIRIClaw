/**
 * Tool dispatch helpers for the agent loop. Runs requested tool calls either
 * sequentially or in parallel, isolating failures so one bad tool never crashes
 * the whole batch.
 */

import type { ToolCall } from '../llm/types.js'
import type { ToolExecutionMode, ToolExecutor, ToolResult } from './types.js'

/** Execute a single call, converting any thrown error into an error ToolResult. */
async function runOne(call: ToolCall, executor: ToolExecutor, signal?: AbortSignal): Promise<ToolResult> {
  try {
    return await executor(call, signal)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      toolCallId: call.id,
      name: call.function.name,
      content: message,
      isError: true,
    }
  }
}

export async function runToolCalls(
  calls: ToolCall[],
  executor: ToolExecutor,
  mode: ToolExecutionMode,
  signal?: AbortSignal,
): Promise<ToolResult[]> {
  if (mode === 'parallel') {
    return Promise.all(calls.map((call) => runOne(call, executor, signal)))
  }

  const results: ToolResult[] = []
  for (const call of calls) {
    results.push(await runOne(call, executor, signal))
  }
  return results
}
