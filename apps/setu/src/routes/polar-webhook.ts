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
			console.error(
				'[POLAR WEBHOOK] Signature verification failed:',
				error.message,
			);
			return c.json({ error: 'Invalid signature' }, 403);
		}
		throw error;
	}

	console.log(`[POLAR WEBHOOK] Received event: ${event.type}`);

	if (event.type === 'order.paid') {
		const orderId = event.data.id;
		const metadata = event.data.metadata;

		// Use checkoutId from metadata if available, otherwise fall back to orderId
		const checkoutId = metadata?.checkoutId || orderId;

		console.log(
			`[POLAR WEBHOOK] Processing order.paid - Order: ${orderId}, Checkout: ${checkoutId}`,
		);

		if (!metadata?.walletAddress || !metadata?.creditAmountUsd) {
			console.error(
				'[POLAR WEBHOOK] Missing metadata in order.paid event:',
				metadata,
			);
			return c.json({ error: 'Missing metadata' }, 400);
		}

		const walletAddress = metadata.walletAddress;
		const creditAmountUsd = parseFloat(metadata.creditAmountUsd);

		// Check for duplicate using checkoutId (primary) or orderId (fallback)
		const existing = await db.query.paymentLogs.findFirst({
			where: (logs, { eq, or }) =>
				or(
					eq(logs.polarCheckoutId, checkoutId),
					eq(logs.polarCheckoutId, orderId),
				),
		});

		if (existing) {
			console.log(
				`[POLAR WEBHOOK] Duplicate: ${checkoutId} already processed, skipping`,
			);
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
			console.log(
				`[POLAR WEBHOOK] Race condition: ${checkoutId} already processed`,
			);
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

	console.log(`[POLAR WEBHOOK] Ignoring event type: ${event.type}`);
	return c.json({ success: true, ignored: true });
});

export default polarWebhook;
