import { Hono } from 'hono';
import { db } from '../../db';
import { paymentLogs } from '../../db/schema';
import { verifyWebhook, WebhookVerificationError } from '../services/polar';
import { creditBalancePolar } from '../services/balance';

const polarWebhook = new Hono();

polarWebhook.post('/v1/webhooks/polar', async (c) => {
	const rawBody = await c.req.text();
	const headers: Record<string, string> = {};
	c.req.raw.headers.forEach((value, key) => {
		headers[key] = value;
	});

	let event;
	try {
		event = verifyWebhook(rawBody, headers);
	} catch (error) {
		if (error instanceof WebhookVerificationError) {
			console.error('[POLAR WEBHOOK] Signature verification failed:', error.message);
			return c.json({ error: 'Invalid signature' }, 403);
		}
		throw error;
	}

	console.log(`[POLAR WEBHOOK] Received event: ${event.type}`);

	if (event.type === 'order.paid') {
		const { id, metadata } = event.data;

		if (!metadata?.walletAddress || !metadata?.creditAmountUsd) {
			console.error('[POLAR WEBHOOK] Missing metadata in order.paid event');
			return c.json({ error: 'Missing metadata' }, 400);
		}

		const walletAddress = metadata.walletAddress;
		const creditAmountUsd = parseFloat(metadata.creditAmountUsd);
		const checkoutId = id;

		const existing = await db.query.paymentLogs.findFirst({
			where: (logs, { eq }) => eq(logs.polarCheckoutId, checkoutId),
		});

		if (existing) {
			console.log(`[POLAR WEBHOOK] Duplicate order.paid for checkout ${checkoutId}, skipping`);
			return c.json({ success: true, duplicate: true });
		}

		const inserted = await db
			.insert(paymentLogs)
			.values({
				walletAddress,
				polarCheckoutId: checkoutId,
				paymentMethod: 'fiat',
				amountUsd: creditAmountUsd.toFixed(2),
				status: 'confirmed',
				verified: true,
			})
			.onConflictDoNothing()
			.returning();

		if (inserted.length === 0) {
			console.log(`[POLAR WEBHOOK] Race condition: checkout ${checkoutId} already processed`);
			return c.json({ success: true, duplicate: true });
		}

		const { newBalance } = await creditBalancePolar(
			walletAddress,
			creditAmountUsd,
			checkoutId,
		);

		console.log(
			`[POLAR WEBHOOK] Credited $${creditAmountUsd} to ${walletAddress} (checkout: ${checkoutId}), new balance: $${newBalance}`,
		);

		return c.json({ success: true, credited: creditAmountUsd, newBalance });
	}

	return c.json({ success: true, ignored: true });
});

export default polarWebhook;
