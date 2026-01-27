import { config } from '../config';

const FACILITATOR_FEE_PAYER = '2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4';
export const MIN_TOPUP_AMOUNT = config.isProdStage ? 5 : 0.10;
export const TOPUP_AMOUNTS = config.isProdStage ? [5, 10, 25, 50] as const : [0.10, 1, 5, 10] as const;

export interface PaymentRequirement {
  scheme: 'exact';
  network: string;
  maxAmountRequired: string;
  asset: string;
  payTo: string;
  resource: string;
  description: string;
  mimeType: string;
  maxTimeoutSeconds: number;
  extra?: { feePayer?: string };
}

export interface X402PaymentPayload {
  x402Version: 1;
  scheme: 'exact';
  network: string;
  payload: { transaction: string };
}

export interface X402SettleResponse {
  success: boolean;
  payer: string;
  transaction: string;
  network: string;
  errorReason?: string;
}

function normalizeResource(resource: string): string {
  if (resource.startsWith('http')) return resource;
  const suffix = resource.startsWith('/') ? resource : `/${resource}`;
  return `https://router.solforge.sh${suffix}`;
}

export function createPaymentRequirement(
  resource: string,
  description: string,
  amountUsd: number,
): PaymentRequirement {
  const amountUsdc = Math.round(amountUsd * 1_000_000);

  return {
    scheme: 'exact',
    network: config.payment.network,
    maxAmountRequired: amountUsdc.toString(),
    asset: config.payment.usdcMint,
    payTo: config.payment.companyWallet,
    resource: normalizeResource(resource),
    description,
    mimeType: 'application/json',
    maxTimeoutSeconds: 60,
    extra: {
      feePayer: FACILITATOR_FEE_PAYER,
    },
  };
}

export function createPaymentRequirements(
  resource: string,
  description: string,
  amounts: readonly number[] = TOPUP_AMOUNTS,
): PaymentRequirement[] {
  return amounts
    .filter((a) => a >= MIN_TOPUP_AMOUNT)
    .map((amount) =>
      createPaymentRequirement(resource, `${description} (${amount.toFixed(2)} USD)`, amount),
    );
}

export async function settlePayment(
  paymentPayload: X402PaymentPayload,
  paymentRequirement: PaymentRequirement,
): Promise<X402SettleResponse> {
  const response = await fetch(`${config.facilitator.url}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentPayload, paymentRequirements: paymentRequirement }),
  });

  if (!response.ok) {
    throw new Error(`Facilitator settle failed: ${response.statusText}`);
  }

  return response.json() as Promise<X402SettleResponse>;
}

export function usdcToUsd(usdcAmount: string): number {
  return parseInt(usdcAmount) / 1_000_000;
}

export function isSupportedTopupAmount(usdcAmount: string): boolean {
  const usd = usdcToUsd(usdcAmount);
  return Number.isFinite(usd) && usd >= MIN_TOPUP_AMOUNT;
}
