import { Hono } from 'hono';
import { Resource } from 'sst';
import { eq, sql } from 'drizzle-orm';
import { createDb } from '../db/client';
import { sharedSessions } from '../db/schema';
import { generateShareId, generateSecret } from '../lib/nanoid';
import type { CreateShareRequest, UpdateShareRequest } from '../types';

export const shareRoutes = new Hono();

shareRoutes.post('/', async (c) => {
	const db = createDb();
	const body = await c.req.json<CreateShareRequest>();

	const shareId = generateShareId();
	const secret = generateSecret();
	const now = Date.now();
	const expiresAt = now + (body.expiresInDays ?? 30) * 24 * 60 * 60 * 1000;

	await db.insert(sharedSessions).values({
		shareId,
		secret,
		title: body.title ?? body.sessionData.title,
		description: body.description ?? null,
		sessionData: JSON.stringify(body.sessionData),
		createdAt: now,
		updatedAt: now,
		expiresAt,
		viewCount: 0,
		lastSyncedMessageId: body.lastMessageId,
	});

	return c.json(
		{
			shareId,
			secret,
			url: `https://share.agi.nitish.sh/s/${shareId}`,
			expiresAt,
		},
		201
	);
});

shareRoutes.get('/:shareId', async (c) => {
	const db = createDb();
	const { shareId } = c.req.param();

	const session = await db.query.sharedSessions.findFirst({
		where: eq(sharedSessions.shareId, shareId),
	});

	if (!session) {
		return c.json({ error: 'Share not found' }, 404);
	}

	if (session.expiresAt && session.expiresAt < Date.now()) {
		return c.json({ error: 'Share has expired' }, 410);
	}

	await db
		.update(sharedSessions)
		.set({ viewCount: sql`${sharedSessions.viewCount} + 1` })
		.where(eq(sharedSessions.shareId, shareId));

	return c.json({
		shareId: session.shareId,
		title: session.title,
		description: session.description,
		sessionData: JSON.parse(session.sessionData),
		createdAt: session.createdAt,
		viewCount: (session.viewCount ?? 0) + 1,
		lastSyncedMessageId: session.lastSyncedMessageId,
	});
});

shareRoutes.put('/:shareId', async (c) => {
	const db = createDb();
	const { shareId } = c.req.param();
	const secret = c.req.header('X-Share-Secret');

	if (!secret) {
		return c.json({ error: 'Missing X-Share-Secret header' }, 401);
	}

	const session = await db.query.sharedSessions.findFirst({
		where: eq(sharedSessions.shareId, shareId),
	});

	if (!session) {
		return c.json({ error: 'Share not found' }, 404);
	}

	if (session.secret !== secret) {
		return c.json({ error: 'Invalid secret' }, 403);
	}

	const body = await c.req.json<UpdateShareRequest>();
	const now = Date.now();

	const updates: Partial<typeof sharedSessions.$inferInsert> = {
		updatedAt: now,
	};

	if (body.title !== undefined) {
		updates.title = body.title;
	}
	if (body.description !== undefined) {
		updates.description = body.description;
	}
	if (body.sessionData) {
		updates.sessionData = JSON.stringify(body.sessionData);
	}
	if (body.lastMessageId) {
		updates.lastSyncedMessageId = body.lastMessageId;
	}

	await db.update(sharedSessions).set(updates).where(eq(sharedSessions.shareId, shareId));

	await Resource.OGCache.delete(shareId);

	return c.json({
		shareId,
		url: `https://share.agi.nitish.sh/s/${shareId}`,
		updated: true,
	});
});

shareRoutes.delete('/:shareId', async (c) => {
	const db = createDb();
	const { shareId } = c.req.param();
	const secret = c.req.header('X-Share-Secret');

	if (!secret) {
		return c.json({ error: 'Missing X-Share-Secret header' }, 401);
	}

	const session = await db.query.sharedSessions.findFirst({
		where: eq(sharedSessions.shareId, shareId),
	});

	if (!session) {
		return c.json({ error: 'Share not found' }, 404);
	}

	if (session.secret !== secret) {
		return c.json({ error: 'Invalid secret' }, 403);
	}

	await db.delete(sharedSessions).where(eq(sharedSessions.shareId, shareId));

	await Resource.OGCache.delete(shareId);

	return c.body(null, 204);
});
