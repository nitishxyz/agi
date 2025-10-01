import { createServer } from '@agi-cli/sdk';
import { loadConfig } from '@agi-cli/sdk';
import { getDb } from '@agi-cli/sdk';
import { intro, outro, select, text, isCancel, cancel } from '@clack/prompts';
import { box, table } from './ui.ts';
import { runAsk } from './ask.ts';

type SessionsOptions = {
	project?: string;
	json?: boolean;
	pick?: boolean;
	limit?: number;
};

type SessionRecord = {
	id: string | number;
	agent: string;
	provider: string;
	model: string;
	title?: string | null;
	createdAt: number;
	lastActiveAt?: number | null;
	[key: string]: unknown;
};

export async function runSessions(opts: SessionsOptions = {}) {
	const projectRoot = opts.project ?? process.cwd();
	const cfg = await loadConfig(projectRoot);
	await getDb(cfg.projectRoot);

	const baseUrl = process.env.AGI_SERVER_URL || (await startEphemeralServer());
	const list = (await httpJson(
		'GET',
		`${baseUrl}/v1/sessions?project=${encodeURIComponent(projectRoot)}`,
	)) as SessionRecord[];
	// De-duplicate by id to avoid any accidental duplicates from the API or client
	const seen = new Set<string>();
	const uniq: SessionRecord[] = [];
	for (const r of list) {
		const id = String(r.id);
		if (seen.has(id)) continue;
		seen.add(id);
		uniq.push(r);
	}
	const rows =
		typeof opts.limit === 'number'
			? uniq.slice(0, Math.max(0, opts.limit))
			: uniq;

	if (opts.json) {
		Bun.write(Bun.stdout, `${JSON.stringify(rows, null, 2)}\n`);
		return;
	}

	if (!rows.length) {
		Bun.write(
			Bun.stdout,
			'No sessions found. Start one with: agi "<prompt>"\n',
		);
		return;
	}

	if (opts.pick) {
		intro('Select a session');
		const choice = await select({
			message: 'Choose a session:',
			options: rows.map((r) => ({
				value: r.id as string,
				label: formatRow(r),
			})),
		});
		if (isCancel(choice)) return cancel('Cancelled');
		// Prompt to send a message to the chosen session; if empty, just print id
		const input = await text({
			message:
				'Enter a message to send to this session (leave empty to just output id)',
		});
		if (isCancel(input)) return cancel('Cancelled');
		const prompt = String(input ?? '').trim();
		if (!prompt) {
			Bun.write(Bun.stdout, `${String(choice)}\n`);
			outro('');
			return;
		}
		// Reuse the ephemeral server for runAsk
		const prev = process.env.AGI_SERVER_URL;
		process.env.AGI_SERVER_URL = baseUrl;
		try {
			await runAsk(prompt, { project: projectRoot, sessionId: String(choice) });
		} finally {
			if (prev !== undefined) process.env.AGI_SERVER_URL = prev;
			else delete process.env.AGI_SERVER_URL;
			if (currentServer) {
				try {
					currentServer.stop();
				} catch {}
				currentServer = null;
			}
		}
		return;
	}

	// Pretty print a simple table
	const trows = rows.map((r) => [
		short(r.id),
		sessionTitle(r),
		relativeTime(r.lastActiveAt ?? r.createdAt),
	]);
	box('Sessions', []);
	table(['ID', 'Title', 'Active'], trows);
	// Stop ephemeral server if we started one
	if (currentServer) {
		try {
			currentServer.stop();
		} catch {}
		currentServer = null;
	}
}

const short = (id: string) => String(id).slice(0, 8);

function agentTitle(name: string): string {
	const cleaned = String(name || '')
		.replace(/[._-]+/g, ' ')
		.trim();
	if (!cleaned) return '';
	return cleaned
		.split(' ')
		.map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
		.join(' ');
}

function _toIso(n: number): string {
	try {
		return new Date(Number(n)).toISOString().replace('T', ' ').replace('Z', '');
	} catch {
		return String(n);
	}
}

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

let currentServer: ReturnType<typeof Bun.serve> | null = null;
async function startEphemeralServer(): Promise<string> {
	if (currentServer) return `http://localhost:${currentServer.port}`;
	const app = createServer();
	currentServer = Bun.serve({ port: 0, fetch: app.fetch, idleTimeout: 240 });
	return `http://localhost:${currentServer.port}`;
}

function formatRow(r: SessionRecord): string {
	const id = `[${short(r.id as string)}]`;
	const title = sessionTitle(r);
	const when = relativeTime(r.lastActiveAt ?? r.createdAt);
	return `${id} ${title} • ${when}`;
}

function sessionTitle(r: SessionRecord): string {
	const t = r.title && String(r.title).trim();
	if (t) return String(t);
	const at = agentTitle(r.agent);
	return at || 'Untitled';
}

function relativeTime(ms: number | null | undefined): string {
	if (!ms) return '-';
	const now = Date.now();
	const d = Math.max(0, now - Number(ms));
	const sec = Math.floor(d / 1000);
	if (sec < 60) return `${sec}s ago`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.floor(hr / 24);
	return `${day}d ago`;
}
