import type { MiddlewareHandler } from 'hono';
import { config } from '../config';
import { getOrCreateUser } from '../services/balance';
import { TOPUP_AMOUNTS, createPaymentRequirements } from '../services/x402';

export const balanceCheck: MiddlewareHandler = async (c, next) => {
  const walletAddress = c.get('walletAddress');

  const user = await getOrCreateUser(walletAddress);
  const balance = parseFloat(user.balanceUsd);

  if (balance < config.minBalance) {
    const deficit = Math.max(0, -balance);
    const requestedAmounts: number[] =
      deficit > 0 ? [Math.max(5, Number((deficit + 0.1).toFixed(2)))] : [...TOPUP_AMOUNTS];

    const paymentRequirements = createPaymentRequirements(
      c.req.url,
      'Top-up required for API access',
      requestedAmounts,
    );

    return c.json(
      {
        x402Version: 1,
        error: {
          message: 'Balance too low. Please top up.',
          type: 'insufficient_balance',
          current_balance: balance.toFixed(2),
          minimum_balance: config.minBalance.toFixed(2),
          topup_required: true,
        },
        accepts: paymentRequirements,
      },
      402,
    );
  }

  c.set('user', user);
  await next();
};
