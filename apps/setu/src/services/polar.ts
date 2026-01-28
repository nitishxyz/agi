import { Polar } from '@polar-sh/sdk';
import { validateEvent } from '@polar-sh/sdk/webhooks';
import { config } from '../config';

let polarClient: Polar | null = null;

export function getPolarClient(): Polar {
	if (!polarClient) {
		polarClient = new Polar({
			accessToken: config.polar.accessToken,
			server: config.polar.server as 'production' | 'sandbox',
		});
	}
	return polarClient;
}

export interface CheckoutResult {
	checkoutId: string;
	checkoutUrl: string;
	creditAmount: number;
	chargeAmount: number;
	feeAmount: number;
}

export function calculateChargeAmount(creditAmountUsd: number): {
	chargeAmountCents: number;
	feeAmountCents: number;
} {
	const { basePercent, internationalPercent, fixedCents } = config.polar.fees;
	const totalPercent = basePercent + internationalPercent;
	const creditCents = Math.round(creditAmountUsd * 100);
	const chargeAmountCents = Math.ceil(
		(creditCents + fixedCents) / (1 - totalPercent),
	);
	const feeAmountCents = chargeAmountCents - creditCents;
	return { chargeAmountCents, feeAmountCents };
}

export async function createCheckoutSession(
	walletAddress: string,
	creditAmountUsd: number,
	successUrl: string,
): Promise<CheckoutResult> {
	const polar = getPolarClient();
	const { chargeAmountCents, feeAmountCents } =
		calculateChargeAmount(creditAmountUsd);
	const productId = config.polar.productId;

	const checkout = await polar.checkouts.create({
		products: [productId],
		prices: {
			[productId]: [
				{
					amountType: 'fixed',
					priceAmount: chargeAmountCents,
					priceCurrency: 'usd',
				},
			],
		},
		successUrl,
		metadata: {
			walletAddress,
			creditAmountUsd: creditAmountUsd.toFixed(2),
		},
	});

	const checkoutId = checkout.id;

	// Update the checkout to include the checkoutId in metadata
	// This allows the webhook to track which checkout was paid
	try {
		await polar.checkouts.update({
			id: checkoutId,
			checkoutUpdate: {
				metadata: {
					walletAddress,
					creditAmountUsd: creditAmountUsd.toFixed(2),
					checkoutId,
				},
			},
		});
	} catch {
		// If update fails, continue - we'll use order ID as fallback
	}

	return {
		checkoutId,
		checkoutUrl: checkout.url,
		creditAmount: creditAmountUsd,
		chargeAmount: chargeAmountCents / 100,
		feeAmount: feeAmountCents / 100,
	};
}

export interface WebhookEvent {
	type: string;
	data: {
		id: string;
		metadata?: Record<string, string>;
		amount?: number;
		currency?: string;
		status?: string;
		productId?: string;
		customerId?: string;
	};
}

export class WebhookVerificationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'WebhookVerificationError';
	}
}

export function verifyWebhook(
	payload: string | Buffer,
	headers: Record<string, string>,
): WebhookEvent {
	try {
		const event = validateEvent(payload, headers, config.polar.webhookSecret);
		return event as WebhookEvent;
	} catch (error) {
		throw new WebhookVerificationError(
			error instanceof Error ? error.message : 'Invalid webhook signature',
		);
	}
}
