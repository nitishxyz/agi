import { createApp } from '@/server/index.ts';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';

type AskOptions = {
  agent?: string;
  provider?: 'openai' | 'anthropic' | 'google';
  model?: string;
  project?: string;
};

export async function runAsk(prompt: string, opts: AskOptions = {}) {
  const projectRoot = opts.project ?? process.cwd();
  const cfg = await loadConfig(projectRoot);
  await getDb(cfg.projectRoot);

  const baseUrl = process.env.AGI_SERVER_URL || (await startEphemeralServer());

  const session = await httpJson('POST', `${baseUrl}/v1/sessions?project=${encodeURIComponent(projectRoot)}`, {
    title: null,
    agent: opts.agent ?? cfg.defaults.agent,
    provider: opts.provider ?? cfg.defaults.provider,
    model: opts.model ?? cfg.defaults.model,
  });

  const sessionId = session.id as string;

  // Start SSE reader before enqueuing the message to avoid missing early events
  const sse = await connectSSE(`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/stream?project=${encodeURIComponent(projectRoot)}`);

  const enqueueRes = await httpJson('POST', `${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/messages?project=${encodeURIComponent(projectRoot)}`, {
    content: prompt,
    agent: opts.agent,
    provider: opts.provider,
    model: opts.model,
  });
  const assistantMessageId = enqueueRes.messageId as string;

  const verbose = process.argv.includes('--verbose');
  const summaryEnabled = process.argv.includes('--summary');
  const jsonEnabled = process.argv.includes('--json');

  let completed = false;
  let finalizeSeen = false;
  let output = '';
  const toolCalls: Array<{ name: string; args?: unknown }> = [];
  const toolResults: Array<{ name: string; result?: unknown; artifact?: any }> = [];
  const filesTouched = new Set<string>();
  try {
    for await (const ev of sse) {
      if (ev.event === 'message.part.delta') {
        const data = safeJson(ev.data);
        if (data?.messageId === assistantMessageId && typeof data?.delta === 'string') {
          output += data.delta;
          // Stream to stdout unless --json; when --json collect only
          if (!jsonEnabled) Bun.write(Bun.stdout, data.delta);
        }
      } else if (ev.event === 'tool.call') {
        const data = safeJson(ev.data);
        const name = data?.name ?? 'tool';
        toolCalls.push({ name, args: data?.args });
        if (!jsonEnabled) printToolCall(name, data?.args, { verbose });
      } else if (ev.event === 'tool.delta') {
        const data = safeJson(ev.data);
        const name = data?.name ?? 'tool';
        const channel = data?.channel ?? 'output';
        if ((channel === 'input' && !verbose) || jsonEnabled) {
          // Avoid noisy input-argument streaming by default
        } else {
          const delta = typeof data?.delta === 'string' ? data.delta : JSON.stringify(data?.delta);
          if (delta) Bun.write(Bun.stderr, `${dim(`[${channel}]`)} ${cyan(name)} ${dim('›')} ${truncate(delta, 160)}\n`);
        }
      } else if (ev.event === 'tool.result') {
        const data = safeJson(ev.data);
        const name = data?.name ?? 'tool';
        toolResults.push({ name, result: data?.result, artifact: data?.artifact });
        if (data?.artifact?.kind === 'file_diff' && typeof data?.artifact?.patch === 'string') {
          for (const f of extractFilesFromPatch(String(data.artifact.patch))) filesTouched.add(f);
        }
        if (name === 'fs_write' && data?.result?.path) filesTouched.add(String(data.result.path));
        if (!jsonEnabled) printToolResult(name, data?.result, data?.artifact, { verbose });
        if (name === 'finalize') finalizeSeen = true;
      } else if (ev.event === 'message.completed') {
        const data = safeJson(ev.data);
        if (data?.id === assistantMessageId) {
          completed = true;
          break;
        }
      } else if (ev.event === 'error') {
        // Print tool errors etc. to stderr
        const data = safeJson(ev.data);
        const msg = data?.error ?? ev.data;
        Bun.write(Bun.stderr, `\n[error] ${String(msg)}\n`);
      }
    }
  } finally {
    await sse.close();
  }

  // Final newline if we streamed content
  if (output.length) Bun.write(Bun.stdout, '\n');

  if (jsonEnabled) {
    const transcript = {
      sessionId,
      assistantMessageId,
      agent: opts.agent ?? cfg.defaults.agent,
      provider: opts.provider ?? cfg.defaults.provider,
      model: opts.model ?? cfg.defaults.model,
      output,
      tools: {
        calls: toolCalls,
        results: toolResults,
      },
      filesTouched: Array.from(filesTouched),
    };
    Bun.write(Bun.stdout, JSON.stringify(transcript, null, 2) + '\n');
  } else if (summaryEnabled || finalizeSeen) {
    printSummary(toolCalls, toolResults, filesTouched);
  }

  // If we started an ephemeral server, stop it
  if (!process.env.AGI_SERVER_URL && currentServer) currentServer.stop();
}

// Ephemeral server support
let currentServer: ReturnType<typeof Bun.serve> | null = null;
async function startEphemeralServer(): Promise<string> {
  if (currentServer) return `http://localhost:${currentServer.port}`;
  const app = createApp();
  currentServer = Bun.serve({ port: 0, fetch: app.fetch });
  return `http://localhost:${currentServer.port}`;
}

// Minimal JSON request helper
async function httpJson(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  return await res.json();
}

// Simple SSE client using fetch + ReadableStream parsing
type SSEEvent = { event: string; data: string };

async function* sseIterator(resp: Response): AsyncGenerator<SSEEvent> {
  if (!resp.body) return;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const lines = raw.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data += (data ? '\n' : '') + line.slice(6);
      }
      if (data) yield { event, data };
    }
  }
}

async function connectSSE(url: string) {
  const controller = new AbortController();
  const res = await fetch(url, { headers: { Accept: 'text/event-stream' }, signal: controller.signal });
  const iterator = sseIterator(res);
  return {
    async *[Symbol.asyncIterator]() {
      for await (const ev of iterator) yield ev;
    },
    async close() {
      // Abort the fetch to close the SSE stream without ReadableStream state errors
      try { controller.abort(); } catch {}
    },
  };
}

function safeJson(input: string): any {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

function extractFilesFromPatch(patch: string): string[] {
  const lines = patch.split('\n');
  const files: string[] = [];
  const re = /^\*\*\*\s+(Add|Update|Delete) File:\s+(.+)$/;
  for (const line of lines) {
    const m = line.match(re);
    if (m) files.push(m[2]);
  }
  return files;
}

function printSummary(
  toolCalls: Array<{ name: string; args?: unknown }>,
  toolResults: Array<{ name: string; result?: unknown; artifact?: any }>,
  filesTouched: Set<string>,
) {
  Bun.write(Bun.stderr, `\n${bold('Summary')}\n`);
  if (toolCalls.length) {
    Bun.write(Bun.stderr, `${bold('Tools used:')}\n`);
    const counts = new Map<string, number>();
    for (const c of toolCalls) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
    for (const [name, count] of counts) {
      const suffix = count > 1 ? ` × ${count}` : '';
      Bun.write(Bun.stderr, `  ${green('•')} ${name}${suffix}\n`);
    }
  }
  if (filesTouched.size) {
    Bun.write(Bun.stderr, `${bold('Files touched:')}\n`);
    for (const f of filesTouched) Bun.write(Bun.stderr, `  ${green('•')} ${f}\n`);
  }
  const diffs = toolResults.filter((r) => r.artifact?.kind === 'file_diff');
  if (diffs.length) {
    Bun.write(Bun.stderr, `${bold('Diff artifacts:')}\n`);
    for (const d of diffs) {
      const s = d.artifact?.summary;
      const sum = s ? ` (files:${s.files ?? '?'}, +${s.additions ?? '?'}, -${s.deletions ?? '?'})` : '';
      Bun.write(Bun.stderr, `  ${yellow('•')} ${d.name}${sum}\n`);
    }
  }
}

// Pretty printing helpers
const reset = (s: string) => `\x1b[0m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

function printToolCall(name: string, args?: any, opts?: { verbose?: boolean }) {
  const v = opts?.verbose;
  const title = `${bold('›')} ${cyan(name)} ${dim('running...')}`;
  if (!args || !v) {
    Bun.write(Bun.stderr, `\n${title}\n`);
    return;
  }
  const preview = truncate(JSON.stringify(args), 200);
  Bun.write(Bun.stderr, `\n${title}\n${dim(preview)}\n`);
}

function printToolResult(name: string, result?: any, artifact?: any, opts?: { verbose?: boolean }) {
  // Special-case pretty formatting for common tools
  if (name === 'fs_tree' && result?.tree) {
    Bun.write(Bun.stderr, `${bold('↳ tree')} ${dim(result.path ?? '.')}\n`);
    Bun.write(Bun.stderr, `${result.tree}\n`);
    return;
  }
  if (name === 'fs_ls' && Array.isArray(result?.entries)) {
    const entries = result.entries as Array<{ name: string; type: string }>;
    Bun.write(Bun.stderr, `${bold('↳ ls')} ${dim(result.path ?? '.')}\n`);
    for (const e of entries.slice(0, 100)) {
      Bun.write(Bun.stderr, `  ${e.type === 'dir' ? '📁' : '📄'} ${e.name}\n`);
    }
    if (entries.length > 100) Bun.write(Bun.stderr, `${dim(`… and ${entries.length - 100} more`) }\n`);
    return;
  }
  if (name === 'fs_read' && typeof result?.path === 'string') {
    const content = String(result?.content ?? '');
    const lines = content.split('\n');
    Bun.write(Bun.stderr, `${bold('↳ read')} ${dim(result.path)} (${lines.length} lines)\n`);
    const sample = lines.slice(0, 20).join('\n');
    Bun.write(Bun.stderr, `${sample}${lines.length > 20 ? '\n' + dim('…') : ''}\n`);
    return;
  }
  if (name === 'fs_write' && typeof result?.path === 'string') {
    Bun.write(Bun.stderr, `${bold('↳ wrote')} ${result.path} (${result?.bytes ?? '?'} bytes)\n`);
    return;
  }
  if (artifact?.kind === 'file_diff' && typeof artifact?.patch === 'string') {
    Bun.write(Bun.stderr, `${bold('↳ diff')} ${dim('(unified patch)')}\n`);
    const patch = artifact.patch.split('\n').slice(0, 80).join('\n');
    Bun.write(Bun.stderr, `${patch}${artifact.patch.split('\n').length > 80 ? '\n' + dim('…') : ''}\n`);
    return;
  }
  if (name === 'finalize') {
    Bun.write(Bun.stderr, `${bold('✓ done')}\n`);
    return;
  }
  // Generic fallback
  const preview = result !== undefined ? truncate(JSON.stringify(result), 200) : '';
  const suffix = artifact?.kind ? ` ${dim(`artifact=${artifact.kind}`)}` : '';
  Bun.write(Bun.stderr, `${bold('↳')} ${cyan(name)}${suffix} ${preview}\n`);
}
