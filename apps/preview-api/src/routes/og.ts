import { Hono } from 'hono';
import { Resource } from 'sst';
import { eq } from 'drizzle-orm';
import { createDb } from '../db/client';
import { sharedSessions } from '../db/schema';
import type { SharedSessionData } from '../types';

export const ogRoutes = new Hono<{ Bindings: { OG_FUNCTION_URL: string } }>();

ogRoutes.get('/page', async (c) => {
	const ogUrl = (c.env.OG_FUNCTION_URL || '').replace(/\/$/, '');
	const query = new URL(c.req.url).search;
	const targetUrl = `${ogUrl}${query}`;

	const res = await fetch(targetUrl);
	if (!res.ok) {
		return c.text('Failed to generate OG image', 500);
	}

	return new Response(res.body, {
		status: 200,
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=86400, s-maxage=86400',
		},
	});
});

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
		title: session.title || 'otto session',
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

	const ogUrl = (c.env.OG_FUNCTION_URL || '').replace(/\/$/, '');
	const targetUrl = `${ogUrl}?${params.toString()}`;

	const res = await fetch(targetUrl);
	if (!res.ok) {
		return c.text('Failed to generate OG image', 500);
	}

	return new Response(res.body, {
		status: 200,
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=86400',
		},
	});
});
