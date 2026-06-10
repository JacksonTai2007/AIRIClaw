/**
 * Tool-call execution helpers — run a batch of tool calls in parallel or
 * sequentially, converting thrown errors into error ToolResults so one
 * failure never crashes the batch.
 */

import type { ToolCall } from '../llm/types.js'
import type { ToolExecutionMode, ToolExecutor, ToolResult } from './types.js'

async function runOne(call: ToolCall, executor: ToolExecutor, signal?: AbortSignal): Promise<ToolResult> {
  try {
    return await executor(call, signal)
  } catch (err) {
    return {
      toolCallId: call.id,
      name: call.function.name,
      content: err instanceof Error ? err.message : String(err),
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
    return Promise.all(calls.map(call => runOne(call, executor, signal)))
  }
  const results: ToolResult[] = []
  for (const call of calls) {
    results.push(await runOne(call, executor, signal))
  }
  return results
}
