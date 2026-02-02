import { Hono } from 'hono';
import { Resource } from 'sst';
import { eq } from 'drizzle-orm';
import { createDb } from '../db/client';
import { sharedSessions } from '../db/schema';
import type { SharedSessionData } from '../types';

export const ogRoutes = new Hono<{ Bindings: { OG_FUNCTION_URL: string } }>();

ogRoutes.get('/:shareId', async (c) => {
	const { shareId } = c.req.param();

	const db = createDb();
	const session = await db.query.sharedSessions.findFirst({
		where: eq(sharedSessions.shareId, shareId),
	});

	if (!session) {
		return c.notFound();
	}

	let data: SharedSessionData;
	if (session.sessionData === 'r2') {
		const obj = await Resource.ShareStorage.get(`sessions/${shareId}.json`);
		if (!obj) {
			return c.notFound();
		}
		data = JSON.parse(await obj.text());
	} else {
		data = JSON.parse(session.sessionData);
	}

	const params = new URLSearchParams({
		shareId,
		title: session.title || 'AGI Session',
		username: data.username || 'anonymous',
		model: data.model,
		provider: data.provider,
		messageCount: data.messages.length.toString(),
		createdAt: session.createdAt.toString(),
	});

	if (data.stats) {
		params.set('inputTokens', data.stats.inputTokens.toString());
		params.set('outputTokens', data.stats.outputTokens.toString());
		params.set('cachedTokens', data.stats.cachedTokens.toString());
	} else if (data.tokenCount) {
		params.set('tokenCount', data.tokenCount.toString());
	}

	const ogUrl = c.env.OG_FUNCTION_URL || process.env.OG_FUNCTION_URL;
	const targetUrl = `${ogUrl}?${params.toString()}`;

	return c.redirect(targetUrl, 302);
});
