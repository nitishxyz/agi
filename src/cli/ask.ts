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
        if (verbose && !jsonEnabled) {
          const args = data?.args !== undefined ? truncate(JSON.stringify(data.args), 200) : '';
          Bun.write(Bun.stderr, `\n[tool.call] ${name} ${args}\n`);
        } else if (!jsonEnabled) {
          Bun.write(Bun.stderr, `\n[tool.call] ${name}\n`);
        }
      } else if (ev.event === 'tool.delta') {
        const data = safeJson(ev.data);
        const name = data?.name ?? 'tool';
        const channel = data?.channel ?? 'output';
        if ((channel === 'input' && !verbose) || jsonEnabled) {
          // Avoid noisy input-argument streaming by default
        } else {
          const delta = typeof data?.delta === 'string' ? data.delta : JSON.stringify(data?.delta);
          if (delta) Bun.write(Bun.stderr, `[tool.delta:${channel}] ${name}: ${truncate(delta, 160)}\n`);
        }
      } else if (ev.event === 'tool.result') {
        const data = safeJson(ev.data);
        const name = data?.name ?? 'tool';
        toolResults.push({ name, result: data?.result, artifact: data?.artifact });
        if (data?.artifact?.kind === 'file_diff' && typeof data?.artifact?.patch === 'string') {
          for (const f of extractFilesFromPatch(String(data.artifact.patch))) filesTouched.add(f);
        }
        if (name === 'fs_write' && data?.result?.path) filesTouched.add(String(data.result.path));
        if (!jsonEnabled) {
          const hasArtifact = data?.artifact ? ` artifact=${data.artifact.kind}` : '';
          const preview = data?.result !== undefined ? truncate(JSON.stringify(data.result), 200) : '';
          Bun.write(Bun.stderr, `[tool.result] ${name}${hasArtifact} ${preview}\n`);
        }
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
  } else if (summaryEnabled) {
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
  Bun.write(Bun.stderr, '\n===== Summary =====\n');
  if (toolCalls.length) {
    Bun.write(Bun.stderr, 'Tools used:\n');
    for (const c of toolCalls) Bun.write(Bun.stderr, `  - ${c.name}\n`);
  }
  if (filesTouched.size) {
    Bun.write(Bun.stderr, 'Files touched:\n');
    for (const f of filesTouched) Bun.write(Bun.stderr, `  - ${f}\n`);
  }
  const diffs = toolResults.filter((r) => r.artifact?.kind === 'file_diff');
  if (diffs.length) {
    Bun.write(Bun.stderr, 'Diff artifacts:\n');
    for (const d of diffs) {
      const s = d.artifact?.summary;
      const sum = s ? ` (files:${s.files ?? '?'}, +${s.additions ?? '?'}, -${s.deletions ?? '?'})` : '';
      Bun.write(Bun.stderr, `  - ${d.name}${sum}\n`);
    }
  }
}
