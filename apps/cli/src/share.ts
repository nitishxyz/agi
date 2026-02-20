import {
	intro,
	outro,
	select,
	confirm,
	isCancel,
	cancel,
} from '@clack/prompts';
import { box } from './ui.ts';
import {
	listSessions,
	getShareStatus,
	shareSession,
	syncShare,
	deleteShare,
	listShares,
} from '@ottocode/api';

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

export async function runShare(opts: ShareOptions) {
	const projectRoot = opts.project ?? process.cwd();

	let sessionId = opts.sessionId;

	if (!sessionId && !opts.list) {
		sessionId = (await pickSession(projectRoot)) ?? undefined;
		if (!sessionId) return;
	}

	if (opts.list) {
		await listSharedSessions(projectRoot);
		return;
	}

	if (!sessionId) {
		console.error('No session specified');
		return;
	}

	if (opts.status) {
		await showStatus(sessionId, projectRoot);
		return;
	}

	if (opts.delete) {
		await deleteShareSession(sessionId, projectRoot);
		return;
	}

	if (opts.update) {
		await updateShareSession(sessionId, projectRoot);
		return;
	}

	await createShareSession(sessionId, projectRoot);
}

async function pickSession(projectRoot: string): Promise<string | null> {
	const { data } = await listSessions({
		query: { project: projectRoot },
	});

	const sessions = (data ?? []) as Array<{
		id: string;
		title?: string | null;
		agent: string;
		lastActiveAt?: number | null;
		createdAt: number;
	}>;

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
			label: `[${s.id.slice(0, 8)}] ${s.title || s.agent || 'Untitled'} • ${relativeTime(s.lastActiveAt ?? s.createdAt)}`,
		})),
	});

	if (isCancel(choice)) {
		cancel('Cancelled');
		return null;
	}

	return choice as string;
}

async function createShareSession(sessionId: string, projectRoot: string) {
	intro('Share session');

	const shouldShare = await confirm({
		message: `Share session ${sessionId.slice(0, 8)} publicly?`,
	});

	if (isCancel(shouldShare) || !shouldShare) {
		cancel('Cancelled');
		return;
	}

	const { data, error } = await shareSession({
		path: { sessionId },
		query: { project: projectRoot },
	});

	if (error || !data) {
		console.error('Failed to share session');
		return;
	}

	const result = data as { shared: boolean; url?: string; message?: string };
	if (result.shared && result.url) {
		outro(`✓ ${result.url}`);
	} else {
		console.log(result.message || 'Share failed');
	}
}

async function updateShareSession(sessionId: string, projectRoot: string) {
	const { data, error } = await syncShare({
		path: { sessionId },
		query: { project: projectRoot },
	});

	if (error || !data) {
		console.error('Failed to sync share');
		return;
	}

	const result = data as {
		synced: boolean;
		url?: string;
		newMessages?: number;
		message?: string;
	};
	if (result.synced) {
		const msg = result.newMessages
			? `with ${result.newMessages} new messages`
			: '';
		console.log(`✓ Updated share ${msg}`);
		if (result.url) console.log(`  ${result.url}`);
	} else {
		console.log(result.message || 'Sync failed');
	}
}

async function deleteShareSession(sessionId: string, projectRoot: string) {
	intro('Delete share');

	const { data: statusData } = await getShareStatus({
		path: { sessionId },
		query: { project: projectRoot },
	});

	const status = statusData as { shared: boolean; url?: string } | undefined;
	if (!status?.shared) {
		console.log('Session is not shared.');
		return;
	}

	const shouldDelete = await confirm({
		message: `Delete shared session at ${status.url}?`,
	});

	if (isCancel(shouldDelete) || !shouldDelete) {
		cancel('Cancelled');
		return;
	}

	const { data, error } = await deleteShare({
		path: { sessionId },
		query: { project: projectRoot },
	});

	if (error || !data) {
		console.error('Failed to delete share');
		return;
	}

	outro('✓ Share deleted');
}

async function showStatus(sessionId: string, projectRoot: string) {
	const { data, error } = await getShareStatus({
		path: { sessionId },
		query: { project: projectRoot },
	});

	if (error || !data) {
		console.log(`\nSession ${sessionId.slice(0, 8)} is not shared.`);
		console.log(`  Run \`otto share ${sessionId.slice(0, 8)}\` to share it.`);
		return;
	}

	const status = data as {
		shared: boolean;
		url?: string;
		title?: string | null;
		syncedMessages?: number;
		totalMessages?: number;
		pendingMessages?: number;
		isSynced?: boolean;
		lastSyncedAt?: number;
	};

	if (!status.shared) {
		console.log(`\nSession ${sessionId.slice(0, 8)} is not shared.`);
		return;
	}

	console.log(`\nShare Status: ${sessionId.slice(0, 8)}`);
	if (status.url) console.log(`  URL: ${status.url}`);
	if (status.title) console.log(`  Title: "${status.title}"`);
	console.log('');
	console.log(
		`  Messages: ${status.syncedMessages ?? 0} synced of ${status.totalMessages ?? 0}`,
	);
	if (status.pendingMessages && status.pendingMessages > 0) {
		console.log(`  ${status.pendingMessages} pending messages`);
	}
	if (status.lastSyncedAt) {
		console.log(`  Last synced: ${relativeTime(status.lastSyncedAt)}`);
	}
}

async function listSharedSessions(projectRoot: string) {
	const { data, error } = await listShares({
		query: { project: projectRoot },
	});

	if (error || !data) {
		console.log('No shared sessions.');
		return;
	}

	const result = data as {
		shares: Array<{
			sessionId: string;
			shareId: string;
			url: string;
			title?: string | null;
			createdAt: number;
			lastSyncedAt: number;
		}>;
	};

	if (!result.shares.length) {
		console.log('No shared sessions.');
		return;
	}

	box('Shared Sessions', []);
	for (const share of result.shares) {
		console.log(`  ${share.sessionId.slice(0, 8)} → ${share.url}`);
		console.log(
			`     "${share.title || 'Untitled'}" • synced ${relativeTime(share.lastSyncedAt)}`,
		);
	}
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
