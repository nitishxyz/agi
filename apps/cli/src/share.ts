import { loadConfig } from '@agi-cli/sdk';
import { getDb, dbSchema } from '@agi-cli/database';
import { eq, desc } from 'drizzle-orm';
import { intro, outro, select, confirm, isCancel, cancel } from '@clack/prompts';
import { box } from './ui.ts';
import { userInfo } from 'node:os';

const API_URL = process.env.AGI_SHARE_API_URL || 'https://api.share.agi.nitish.sh';

export interface ShareOptions {
	project: string;
	sessionId?: string;
	title?: string;
	description?: string;
	until?: string;
	update?: boolean;
	delete?: boolean;
	status?: boolean;
	list?: boolean;
}

interface SessionRecord {
	id: string;
	title: string | null;
	agent: string;
	provider: string;
	model: string;
	createdAt: number;
	lastActiveAt: number | null;
	totalInputTokens: number | null;
	totalOutputTokens: number | null;
}

function getUsername(): string {
	try {
		return userInfo().username;
	} catch {
		return 'anonymous';
	}
}

export async function runShare(opts: ShareOptions) {
	const projectRoot = opts.project ?? process.cwd();
	const cfg = await loadConfig(projectRoot);
	const db = await getDb(cfg.projectRoot);

	if (opts.list) {
		await listShares(db, projectRoot);
		return;
	}

	let sessionId = opts.sessionId;

	if (!sessionId && !opts.list) {
		sessionId = await pickSession(db, projectRoot);
		if (!sessionId) return;
	}

	if (!sessionId) {
		console.error('No session specified');
		return;
	}

	if (opts.status) {
		await showStatus(db, sessionId, projectRoot);
		return;
	}

	if (opts.delete) {
		await deleteShare(db, sessionId);
		return;
	}

	if (opts.update) {
		await updateShare(db, sessionId, opts);
		return;
	}

	await createShare(db, sessionId, opts);
}

async function pickSession(db: Awaited<ReturnType<typeof getDb>>, projectRoot: string): Promise<string | null> {
	const sessions = await db.query.sessions.findMany({
		where: eq(dbSchema.sessions.projectPath, projectRoot),
		orderBy: [desc(dbSchema.sessions.lastActiveAt)],
		limit: 20,
	});

	if (!sessions.length) {
		console.log('No sessions found.');
		return null;
	}

	intro('Select a session to share');
	const choice = await select({
		message: 'Choose a session:',
		maxItems: 10,
		options: sessions.map((s) => ({
			value: s.id,
			label: formatSession(s as SessionRecord),
		})),
	});

	if (isCancel(choice)) {
		cancel('Cancelled');
		return null;
	}

	return choice as string;
}

async function createShare(db: Awaited<ReturnType<typeof getDb>>, sessionId: string, opts: ShareOptions) {
	const session = await db.query.sessions.findFirst({
		where: eq(dbSchema.sessions.id, sessionId),
	});

	if (!session) {
		console.error(`Session ${sessionId} not found`);
		return;
	}

	const existingShare = await db.query.shares.findFirst({
		where: eq(dbSchema.shares.sessionId, sessionId),
	});

	if (existingShare) {
		console.log(`Session already shared: ${existingShare.url}`);
		console.log('Use --update to sync new messages');
		return;
	}

	const messages = await db.query.messages.findMany({
		where: eq(dbSchema.messages.sessionId, sessionId),
		orderBy: [dbSchema.messages.createdAt],
		with: { parts: true },
	});

	if (!messages.length) {
		console.error('Session has no messages');
		return;
	}

	let lastMessageId = messages[messages.length - 1].id;
	let messagesToShare = messages;

	if (opts.until) {
		const untilIdx = messages.findIndex((m) => m.id === opts.until);
		if (untilIdx === -1) {
			console.error(`Message ${opts.until} not found in session`);
			return;
		}
		messagesToShare = messages.slice(0, untilIdx + 1);
		lastMessageId = opts.until;
	}

	intro('Share session');

	const shouldShare = await confirm({
		message: `Share "${session.title || 'Untitled'}" publicly? (${messagesToShare.length} messages)`,
	});

	if (isCancel(shouldShare) || !shouldShare) {
		cancel('Cancelled');
		return;
	}

	const sessionData = {
		title: opts.title ?? session.title,
		username: getUsername(),
		agent: session.agent,
		provider: session.provider,
		model: session.model,
		createdAt: session.createdAt,
		tokenCount: (session.totalInputTokens ?? 0) + (session.totalOutputTokens ?? 0),
		messages: messagesToShare.map((m) => ({
			id: m.id,
			role: m.role,
			createdAt: m.createdAt,
			parts: m.parts.map((p) => ({
				type: p.type,
				content: p.content,
				toolName: p.toolName,
				toolCallId: p.toolCallId,
			})),
		})),
	};

	const res = await fetch(`${API_URL}/share`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			sessionData,
			title: opts.title ?? session.title,
			description: opts.description,
			lastMessageId,
		}),
	});

	if (!res.ok) {
		const err = await res.text();
		console.error(`Failed to create share: ${err}`);
		return;
	}

	const data = await res.json() as { shareId: string; secret: string; url: string };

	await db.insert(dbSchema.shares).values({
		sessionId,
		shareId: data.shareId,
		secret: data.secret,
		url: data.url,
		title: opts.title ?? session.title,
		description: opts.description ?? null,
		createdAt: Date.now(),
		lastSyncedAt: Date.now(),
		lastSyncedMessageId: lastMessageId,
	});

	outro(`✓ ${data.url}`);
	console.log('  (Secret saved for future updates)');
}

async function updateShare(db: Awaited<ReturnType<typeof getDb>>, sessionId: string, opts: ShareOptions) {
	const share = await db.query.shares.findFirst({
		where: eq(dbSchema.shares.sessionId, sessionId),
	});

	if (!share) {
		console.error('Session is not shared. Use `agi share` to share it first.');
		return;
	}

	const session = await db.query.sessions.findFirst({
		where: eq(dbSchema.sessions.id, sessionId),
	});

	if (!session) {
		console.error(`Session ${sessionId} not found`);
		return;
	}

	const messages = await db.query.messages.findMany({
		where: eq(dbSchema.messages.sessionId, sessionId),
		orderBy: [dbSchema.messages.createdAt],
		with: { parts: true },
	});

	const lastSyncedIdx = messages.findIndex((m) => m.id === share.lastSyncedMessageId);
	let newMessages = lastSyncedIdx === -1 ? messages : messages.slice(lastSyncedIdx + 1);
	let newLastMessageId = messages[messages.length - 1]?.id ?? share.lastSyncedMessageId;

	if (opts.until) {
		const untilIdx = messages.findIndex((m) => m.id === opts.until);
		if (untilIdx === -1) {
			console.error(`Message ${opts.until} not found in session`);
			return;
		}
		const startIdx = lastSyncedIdx === -1 ? 0 : lastSyncedIdx + 1;
		if (untilIdx < startIdx) {
			console.log('Already synced past that message');
			return;
		}
		newMessages = messages.slice(startIdx, untilIdx + 1);
		newLastMessageId = opts.until;
	}

	const allMessages = messages.slice(0, messages.findIndex((m) => m.id === newLastMessageId) + 1);

	const sessionData = {
		title: opts.title ?? session.title,
		username: getUsername(),
		agent: session.agent,
		provider: session.provider,
		model: session.model,
		createdAt: session.createdAt,
		tokenCount: (session.totalInputTokens ?? 0) + (session.totalOutputTokens ?? 0),
		messages: allMessages.map((m) => ({
			id: m.id,
			role: m.role,
			createdAt: m.createdAt,
			parts: m.parts.map((p) => ({
				type: p.type,
				content: p.content,
				toolName: p.toolName,
				toolCallId: p.toolCallId,
			})),
		})),
	};

	const res = await fetch(`${API_URL}/share/${share.shareId}`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			'X-Share-Secret': share.secret,
		},
		body: JSON.stringify({
			sessionData,
			title: opts.title,
			description: opts.description,
			lastMessageId: newLastMessageId,
		}),
	});

	if (!res.ok) {
		const err = await res.text();
		console.error(`Failed to update share: ${err}`);
		return;
	}

	await db.update(dbSchema.shares)
		.set({
			title: opts.title ?? share.title,
			description: opts.description ?? share.description,
			lastSyncedAt: Date.now(),
			lastSyncedMessageId: newLastMessageId,
		})
		.where(eq(dbSchema.shares.sessionId, sessionId));

	const addedCount = newMessages.length;
	console.log(`✓ Updated share${addedCount > 0 ? ` with ${addedCount} new messages` : ''}`);
	console.log(`  ${share.url}`);
}

async function deleteShare(db: Awaited<ReturnType<typeof getDb>>, sessionId: string) {
	const share = await db.query.shares.findFirst({
		where: eq(dbSchema.shares.sessionId, sessionId),
	});

	if (!share) {
		console.error('Session is not shared.');
		return;
	}

	intro('Delete share');
	const shouldDelete = await confirm({
		message: `Delete shared session at ${share.url}?`,
	});

	if (isCancel(shouldDelete) || !shouldDelete) {
		cancel('Cancelled');
		return;
	}

	const res = await fetch(`${API_URL}/share/${share.shareId}`, {
		method: 'DELETE',
		headers: { 'X-Share-Secret': share.secret },
	});

	if (!res.ok && res.status !== 404) {
		const err = await res.text();
		console.error(`Failed to delete share: ${err}`);
		return;
	}

	await db.delete(dbSchema.shares).where(eq(dbSchema.shares.sessionId, sessionId));

	outro('✓ Share deleted');
}

async function showStatus(db: Awaited<ReturnType<typeof getDb>>, sessionId: string, _projectRoot: string) {
	const share = await db.query.shares.findFirst({
		where: eq(dbSchema.shares.sessionId, sessionId),
	});

	if (!share) {
		const messages = await db.query.messages.findMany({
			where: eq(dbSchema.messages.sessionId, sessionId),
		});
		console.log(`\nSession ${sessionId.slice(0, 8)} is not shared.`);
		console.log(`  Messages: ${messages.length}`);
		console.log(`  Run \`agi share ${sessionId.slice(0, 8)}\` to share it.`);
		return;
	}

	const messages = await db.query.messages.findMany({
		where: eq(dbSchema.messages.sessionId, sessionId),
		orderBy: [dbSchema.messages.createdAt],
	});

	const syncedIdx = messages.findIndex((m) => m.id === share.lastSyncedMessageId);
	const syncedCount = syncedIdx === -1 ? 0 : syncedIdx + 1;
	const totalCount = messages.length;
	const newCount = totalCount - syncedCount;

	console.log(`\nShare Status: ${sessionId.slice(0, 8)}`);
	console.log(`  URL: ${share.url}`);
	if (share.title) console.log(`  Title: "${share.title}"`);
	console.log('');
	console.log(`  Synced until: ${share.lastSyncedMessageId.slice(0, 8)} (message ${syncedCount} of ${totalCount})`);
	if (newCount > 0) console.log(`  ${newCount} new messages since last sync`);
	console.log('');
	console.log(`  Last synced: ${relativeTime(share.lastSyncedAt)}`);
}

async function listShares(db: Awaited<ReturnType<typeof getDb>>, _projectRoot: string) {
	const shares = await db.query.shares.findMany();

	if (!shares.length) {
		console.log('No shared sessions.');
		return;
	}

	box('Shared Sessions', []);
	for (const share of shares) {
		const session = await db.query.sessions.findFirst({
			where: eq(dbSchema.sessions.id, share.sessionId),
		});
		const messages = await db.query.messages.findMany({
			where: eq(dbSchema.messages.sessionId, share.sessionId),
		});
		const title = share.title || session?.title || 'Untitled';
		console.log(`  ${share.sessionId.slice(0, 8)} → ${share.url}`);
		console.log(`     "${title}" (${messages.length} messages)`);
	}
}

function formatSession(s: SessionRecord): string {
	const id = `[${s.id.slice(0, 8)}]`;
	const title = s.title || s.agent || 'Untitled';
	const when = relativeTime(s.lastActiveAt ?? s.createdAt);
	return `${id} ${title} • ${when}`;
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
