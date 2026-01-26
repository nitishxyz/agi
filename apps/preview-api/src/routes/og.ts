import { Hono } from 'hono';
import { Resource } from 'sst';
import satori from 'satori';
import { eq } from 'drizzle-orm';
import { createDb } from '../db/client';
import { sharedSessions } from '../db/schema';
import { OGImage } from '../components/OGImage';
import type { SharedSessionData } from '../types';

export const ogRoutes = new Hono();

const CACHE_TTL = 86400;

async function loadFont(): Promise<ArrayBuffer> {
	const response = await fetch(
		'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2',
	);
	return response.arrayBuffer();
}

ogRoutes.get('/:shareId', async (c) => {
	const { shareId } = c.req.param();

	const cached = await Resource.OGCache.get(shareId, 'arrayBuffer');
	if (cached) {
		return new Response(cached, {
			headers: {
				'Content-Type': 'image/svg+xml',
				'Cache-Control': `public, max-age=${CACHE_TTL}`,
			},
		});
	}

	const db = createDb();
	const session = await db.query.sharedSessions.findFirst({
		where: eq(sharedSessions.shareId, shareId),
	});

	if (!session) {
		return c.notFound();
	}

	const data: SharedSessionData = JSON.parse(session.sessionData);

	const font = await loadFont();

	const svg = await satori(
		OGImage({
			title: session.title || 'AGI Session',
			description: session.description,
			username: data.username || 'anonymous',
			model: data.model,
			messageCount: data.messages.length,
			tokenCount: data.tokenCount,
			createdAt: session.createdAt,
			shareId,
		}),
		{
			width: 1200,
			height: 630,
			fonts: [
				{
					name: 'Inter',
					data: font,
					weight: 400,
					style: 'normal',
				},
				{
					name: 'Inter',
					data: font,
					weight: 700,
					style: 'normal',
				},
			],
		},
	);

	await Resource.OGCache.put(shareId, svg, { expirationTtl: CACHE_TTL });

	return new Response(svg, {
		headers: {
			'Content-Type': 'image/svg+xml',
			'Cache-Control': `public, max-age=${CACHE_TTL}`,
		},
	});
});
