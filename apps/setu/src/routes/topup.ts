import { Hono } from 'hono';
import { walletAuth } from '../middleware/auth';
import { db } from '../../db';
import { paymentLogs } from '../../db/schema';
import { config } from '../config';
import { creditBalance, getOrCreateUser } from '../services/balance';
import {
  isSupportedTopupAmount,
  settlePayment,
  usdcToUsd,
  type PaymentRequirement,
  type X402PaymentPayload,
} from '../services/x402';

type Variables = { walletAddress: string };

const topup = new Hono<{ Variables: Variables }>();

const walletLocks = new Map<string, Promise<unknown>>();

async function withWalletLock<T>(walletAddress: string, fn: () => Promise<T>): Promise<T> {
  const existing = walletLocks.get(walletAddress);
  
  const execute = async () => {
    if (existing) {
      await existing.catch(() => {});
    }
    return fn();
  };
  
  const promise = execute();
  walletLocks.set(walletAddress, promise);
  
  try {
    return await promise;
  } finally {
    if (walletLocks.get(walletAddress) === promise) {
      walletLocks.delete(walletAddress);
    }
  }
}

topup.post('/v1/topup', walletAuth, async (c) => {
  const walletAddress = c.get('walletAddress');
  const body = await c.req.json();

  const { paymentPayload, paymentRequirement } = body as {
    paymentPayload: X402PaymentPayload;
    paymentRequirement?: PaymentRequirement;
  };

  if (!paymentPayload?.payload?.transaction) {
    return c.json({ error: 'Missing payment payload' }, 400);
  }

  if (!paymentRequirement) {
    return c.json({ error: 'Missing payment requirement' }, 400);
  }

  if (paymentRequirement.scheme !== 'exact') {
    return c.json({ error: 'Unsupported payment scheme' }, 400);
  }

  if (paymentRequirement.network !== config.payment.network) {
    return c.json({ error: 'Unsupported network' }, 400);
  }

  if (!isSupportedTopupAmount(paymentRequirement.maxAmountRequired)) {
    return c.json({ error: 'Unsupported top-up amount' }, 400);
  }

  if (paymentRequirement.asset !== config.payment.usdcMint) {
    return c.json({ error: 'Unsupported asset' }, 400);
  }

  if (paymentRequirement.payTo !== config.payment.companyWallet) {
    return c.json({ error: 'Invalid payment destination' }, 400);
  }

  return withWalletLock(walletAddress, async () => {
    let settlement;
    try {
      settlement = await settlePayment(paymentPayload, paymentRequirement);
    } catch (error: any) {
      return c.json({ error: 'Payment settlement failed', details: error.message }, 400);
    }

    if (!settlement.success) {
      return c.json({ error: 'Payment settlement failed', reason: settlement.errorReason }, 400);
    }

    const txSignature = settlement.transaction;
    const amount = usdcToUsd(paymentRequirement.maxAmountRequired);

    // Check for duplicate FIRST before on-chain verification
    const existing = await db.query.paymentLogs.findFirst({
      where: (logs, { eq }) => eq(logs.txSignature, txSignature),
    });

    if (existing) {
      const user = await getOrCreateUser(walletAddress);
      const balanceValue = parseFloat(user.balanceUsd);
      return c.json({
        success: true,
        duplicate: true,
        amount,
        balance: balanceValue,
        new_balance: balanceValue.toFixed(8),
        transaction: txSignature,
      });
    }

    // Facilitator already waits for on-chain confirmation before returning success
    // Insert payment log (with unique constraint protection)
    const inserted = await db
      .insert(paymentLogs)
      .values({
        walletAddress,
        txSignature,
        amountUsd: amount.toFixed(2),
        status: 'confirmed',
        verified: true,
      })
      .onConflictDoNothing({ target: paymentLogs.txSignature })
      .returning();

    if (inserted.length === 0) {
      // Race condition: another request already processed this tx
      const user = await getOrCreateUser(walletAddress);
      const balanceValue = parseFloat(user.balanceUsd);
      return c.json({
        success: true,
        duplicate: true,
        amount,
        balance: balanceValue,
        new_balance: balanceValue.toFixed(8),
        transaction: txSignature,
      });
    }

    const { newBalance } = await creditBalance(walletAddress, amount, txSignature);

    console.log(`[TOPUP] Credited $${amount} to ${walletAddress} (tx: ${txSignature})`);

    return c.json({
      success: true,
      amount,
      balance: newBalance,
      new_balance: newBalance.toFixed(8),
      amount_usd: amount.toFixed(2),
      transaction: txSignature,
    });
  });
});

export default topup;
