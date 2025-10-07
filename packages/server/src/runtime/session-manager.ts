import { desc, eq } from 'drizzle-orm';
import type { AGIConfig } from '@agi-cli/sdk';
import type { DB } from '@agi-cli/database';
import { sessions } from '@agi-cli/database/schema';
import {
	validateProviderModel,
	isProviderAuthorized,
	ensureProviderEnv,
	type ProviderId,
} from '@agi-cli/sdk';
import { publish } from '../events/bus.ts';

type SessionRow = typeof sessions.$inferSelect;

type CreateSessionInput = {
	db: DB;
	cfg: AGIConfig;
	agent: string;
	provider: ProviderId;
	model: string;
	title?: string | null;
};

export async function createSession({
	db,
	cfg,
	agent,
	provider,
	model,
	title,
}: CreateSessionInput): Promise<SessionRow> {
	validateProviderModel(provider, model);
	const authorized = await isProviderAuthorized(cfg, provider);
	if (!authorized) {
		throw new Error(
			`Provider ${provider} is not configured. Run \`agi auth login\` to add credentials.`,
		);
	}
	await ensureProviderEnv(cfg, provider);
	const id = crypto.randomUUID();
	const now = Date.now();
	const row = {
		id,
		title: title ?? null,
		agent,
		provider,
		model,
		projectPath: cfg.projectRoot,
		createdAt: now,
	};
	await db.insert(sessions).values(row);
	publish({ type: 'session.created', sessionId: id, payload: row });
	return row;
}

type GetSessionInput = {
	db: DB;
	projectPath: string;
	sessionId: string;
};

export async function getSessionById({
	db,
	projectPath,
	sessionId,
}: GetSessionInput): Promise<SessionRow | undefined> {
	const rows = await db
		.select()
		.from(sessions)
		.where(eq(sessions.id, sessionId));
	if (!rows.length) return undefined;
	const row = rows[0];
	if (row.projectPath !== projectPath) return undefined;
	return row;
}

type GetLastSessionInput = { db: DB; projectPath: string };

export async function getLastSession({
	db,
	projectPath,
}: GetLastSessionInput): Promise<SessionRow | undefined> {
	const rows = await db
		.select()
		.from(sessions)
		.where(eq(sessions.projectPath, projectPath))
		.orderBy(desc(sessions.lastActiveAt), desc(sessions.createdAt))
		.limit(1);
	return rows[0];
}
