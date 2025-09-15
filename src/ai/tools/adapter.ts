import type { Tool } from 'ai';
import type { DB } from '@/db/index.ts';
import { messageParts } from '@/db/schema/index.ts';
import { publish } from '@/server/events/bus.ts';
import type { DiscoveredTool } from '@/ai/tools/loader.ts';

export type ToolAdapterContext = {
  sessionId: string;
  messageId: string; // assistant message id to attach parts to
  db: DB;
  agent: string;
  provider: string;
  model: string;
  projectRoot: string;
};

export function adaptTools(tools: DiscoveredTool[], ctx: ToolAdapterContext) {
  const out: Record<string, Tool> = {};
  for (const { name, tool } of tools) {
    const base = tool;
    out[name] = {
      ...base,
      async onInputAvailable(options: any) {
        const args = options?.input;
        publish({ type: 'tool.call', sessionId: ctx.sessionId, payload: { name, args } });
        const callPartId = crypto.randomUUID();
        await ctx.db.insert(messageParts).values({
          id: callPartId,
          messageId: ctx.messageId,
          index: Date.now(),
          type: 'tool_call',
          content: JSON.stringify({ name, args }),
          agent: ctx.agent,
          provider: ctx.provider,
          model: ctx.model,
        });
        if (typeof base.onInputAvailable === 'function') {
          await base.onInputAvailable(options);
        }
      },
      async execute(input: any, options: any) {
        const result = await (base as any).execute?.(input, options);
        const resultPartId = crypto.randomUUID();
        await ctx.db.insert(messageParts).values({
          id: resultPartId,
          messageId: ctx.messageId,
          index: Date.now(),
          type: 'tool_result',
          content: JSON.stringify({ name, result }),
          agent: ctx.agent,
          provider: ctx.provider,
          model: ctx.model,
        });
        publish({ type: 'tool.result', sessionId: ctx.sessionId, payload: { name, result } });
        return result;
      },
    } as Tool;
  }
  return out;
}
