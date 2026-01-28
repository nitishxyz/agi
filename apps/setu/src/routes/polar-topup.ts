import { Hono } from 'hono';
import { walletAuth } from '../middleware/auth';
import { config } from '../config';
import {
	createCheckoutSession,
	calculateChargeAmount,
} from '../services/polar';
import { db } from '../../db';

type Variables = { walletAddress: string };

const polarTopup = new Hono<{ Variables: Variables }>();

polarTopup.post('/v1/topup/polar', walletAuth, async (c) => {
	const walletAddress = c.get('walletAddress');
	const body = await c.req.json();

	const { amount, successUrl } = body as {
		amount: number;
		successUrl: string;
	};

	if (typeof amount !== 'number' || amount <= 0) {
		return c.json({ error: 'Invalid amount' }, 400);
	}

	if (amount < config.polar.minTopupUsd) {
		return c.json(
			{ error: `Minimum top-up amount is $${config.polar.minTopupUsd}` },
			400,
		);
	}

	if (amount > config.polar.maxTopupUsd) {
		return c.json(
			{ error: `Maximum top-up amount is $${config.polar.maxTopupUsd}` },
			400,
		);
	}

	if (!successUrl || typeof successUrl !== 'string') {
		return c.json({ error: 'Missing successUrl' }, 400);
	}

	try {
		const result = await createCheckoutSession(
			walletAddress,
			amount,
			successUrl,
		);

		console.log(
			`[POLAR] Created checkout ${result.checkoutId} for ${walletAddress}: $${amount} credit, $${result.chargeAmount} charge`,
		);

		return c.json({
			success: true,
			checkoutId: result.checkoutId,
			checkoutUrl: result.checkoutUrl,
			creditAmount: result.creditAmount,
			chargeAmount: result.chargeAmount,
			feeAmount: result.feeAmount,
		});
	} catch (error) {
		console.error('[POLAR] Checkout creation failed:', error);
		return c.json(
			{
				error: 'Failed to create checkout session',
				details: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		);
	}
});

polarTopup.get('/v1/topup/polar/estimate', async (c) => {
	const amountParam = c.req.query('amount');
	const amount = parseFloat(amountParam || '0');

	if (!amount || amount <= 0) {
		return c.json({ error: 'Invalid amount' }, 400);
	}

	if (amount < config.polar.minTopupUsd || amount > config.polar.maxTopupUsd) {
		return c.json(
			{
				error: `Amount must be between $${config.polar.minTopupUsd} and $${config.polar.maxTopupUsd}`,
			},
			400,
		);
	}

	const { chargeAmountCents, feeAmountCents } = calculateChargeAmount(amount);

	return c.json({
		creditAmount: amount,
		chargeAmount: chargeAmountCents / 100,
		feeAmount: feeAmountCents / 100,
		feeBreakdown: {
			basePercent: config.polar.fees.basePercent * 100,
			internationalPercent: config.polar.fees.internationalPercent * 100,
			fixedCents: config.polar.fees.fixedCents,
		},
	});
});

polarTopup.get('/v1/topup/polar/status', async (c) => {
	const checkoutId = c.req.query('checkoutId');

	if (!checkoutId) {
		return c.json({ error: 'Missing checkoutId parameter' }, 400);
	}

	try {
		const payment = await db.query.paymentLogs.findFirst({
			where: (logs, { eq, and }) =>
				and(eq(logs.polarCheckoutId, checkoutId), eq(logs.status, 'confirmed')),
		});

		return c.json({
			checkoutId,
			confirmed: !!payment,
			amountUsd: payment ? parseFloat(payment.amountUsd) : null,
			confirmedAt: payment?.createdAt ?? null,
		});
	} catch (error) {
		console.error('[POLAR] Status check failed:', error);
		return c.json({ error: 'Failed to check status' }, 500);
	}
});

export default polarTopup;
