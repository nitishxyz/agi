import type { Tool } from 'ai';
import type { DB } from '@/db/index.ts';
import { messageParts } from '@/db/schema/index.ts';
import { publish } from '@/server/events/bus.ts';
import type { DiscoveredTool } from '@/ai/tools/loader.ts';
import { getCwd, setCwd, joinRelative } from '@/server/runtime/cwd.ts';

export type ToolAdapterContext = {
  sessionId: string;
  messageId: string; // assistant message id to attach parts to
  assistantPartId: string;
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
      async onInputStart(options: any) {
        if (typeof base.onInputStart === 'function') await base.onInputStart(options);
      },
      async onInputDelta(options: any) {
        const delta = options?.inputTextDelta;
        // Special handling: if finalize is streaming a 'text' input, treat it as assistant text delta
        if (name === 'finalize' && typeof delta === 'string' && delta.length) {
          publish({ type: 'message.part.delta', sessionId: ctx.sessionId, payload: { messageId: ctx.messageId, partId: ctx.assistantPartId, delta } });
          try {
            // Append to the assistant text part content
            const rows = await ctx.db.select().from(messageParts).where((f, { eq }) => eq(messageParts.id, ctx.assistantPartId));
            if (rows.length) {
              const current = rows[0];
              let obj = { text: '' as string };
              try { obj = JSON.parse(current.content || '{}'); } catch {}
              obj.text = String((obj.text || '') + delta);
              await ctx.db.update(messageParts).set({ content: JSON.stringify(obj) }).where((f, { eq }) => eq(messageParts.id, ctx.assistantPartId));
            }
          } catch {}
        } else {
          // Stream tool argument deltas as events if needed
          publish({ type: 'tool.delta', sessionId: ctx.sessionId, payload: { name, channel: 'input', delta } });
          if (typeof base.onInputDelta === 'function') await base.onInputDelta(options);
        }
      },
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
        // Handle session-relative paths and cwd tools
        let res: any;
        const cwd = getCwd(ctx.sessionId);
        if (name === 'fs_pwd') {
          res = { cwd };
        } else if (name === 'fs_cd') {
          const next = joinRelative(cwd, String(input?.path ?? '.'));
          setCwd(ctx.sessionId, next);
          res = { cwd: next };
        } else if (name.startsWith('fs_') && typeof input?.path === 'string') {
          const rel = joinRelative(cwd, String(input.path));
          input = { ...input, path: rel };
          res = (base as any).execute?.(input, options);
        } else {
          res = (base as any).execute?.(input, options);
        }
        let result: any = res;
        // If tool returns an async iterable, stream deltas while accumulating
        if (res && typeof res === 'object' && Symbol.asyncIterator in res) {
          const chunks: any[] = [];
          for await (const chunk of res as AsyncIterable<any>) {
            chunks.push(chunk);
            publish({ type: 'tool.delta', sessionId: ctx.sessionId, payload: { name, channel: 'output', delta: chunk } });
          }
          // Prefer the last chunk as the result if present, otherwise the entire array
          result = chunks.length > 0 ? chunks[chunks.length - 1] : null;
        } else {
          // Await promise or passthrough value
          result = await res;
        }
        const resultPartId = crypto.randomUUID();
        const contentObj: any = { name, result };
        if (result && typeof result === 'object' && 'artifact' in result) {
          try {
            contentObj.artifact = (result as any).artifact;
          } catch {}
        }
        await ctx.db.insert(messageParts).values({
          id: resultPartId,
          messageId: ctx.messageId,
          index: Date.now(),
          type: 'tool_result',
          content: JSON.stringify(contentObj),
          agent: ctx.agent,
          provider: ctx.provider,
          model: ctx.model,
        });
        publish({ type: 'tool.result', sessionId: ctx.sessionId, payload: contentObj });
        return result;
      },
    } as Tool;
  }
  return out;
}
