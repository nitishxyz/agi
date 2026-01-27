import { db } from '../../db';
import { users, transactions } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { calculateCost, type TokenUsage } from './pricing';

export async function getOrCreateUser(walletAddress: string) {
  let user = await db.query.users.findFirst({
    where: eq(users.walletAddress, walletAddress),
  });

  if (!user) {
    const [newUser] = await db
      .insert(users)
      .values({ walletAddress, balanceUsd: '0.00000000' })
      .returning();
    user = newUser;
  }

  return user;
}

export async function getBalance(walletAddress: string): Promise<number> {
  const user = await getOrCreateUser(walletAddress);
  return parseFloat(user.balanceUsd);
}

export async function deductCost(
  walletAddress: string,
  provider: string,
  model: string,
  usage: TokenUsage,
  markup: number,
): Promise<{ cost: number; newBalance: number }> {
  const cost = calculateCost(model, usage, markup);

  const user = await db.query.users.findFirst({
    where: eq(users.walletAddress, walletAddress),
  });

  if (!user) {
    throw new Error('User not found');
  }

  const oldBalance = parseFloat(user.balanceUsd);
  const newBalance = oldBalance - cost;

  await db
    .update(users)
    .set({
      balanceUsd: newBalance.toFixed(8),
      totalSpent: (parseFloat(user.totalSpent) + cost).toFixed(8),
      requestCount: user.requestCount + 1,
      lastRequest: new Date(),
    })
    .where(eq(users.walletAddress, walletAddress));

  await db.insert(transactions).values({
    walletAddress,
    type: 'deduction',
    amountUsd: cost.toFixed(8),
    provider,
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    balanceBefore: oldBalance.toFixed(8),
    balanceAfter: newBalance.toFixed(8),
  });

  return { cost, newBalance };
}

export async function creditBalance(
  walletAddress: string,
  amount: number,
  txSignature: string,
): Promise<{ newBalance: number }> {
  let user = await db.query.users.findFirst({
    where: eq(users.walletAddress, walletAddress),
  });

  if (!user) {
    const [newUser] = await db
      .insert(users)
      .values({ walletAddress, balanceUsd: '0.00000000' })
      .returning();
    user = newUser;
  }

  const oldBalance = parseFloat(user.balanceUsd);
  const newBalance = oldBalance + amount;

  await db
    .update(users)
    .set({
      balanceUsd: newBalance.toFixed(8),
      totalTopups: (parseFloat(user.totalTopups) + amount).toFixed(2),
    })
    .where(eq(users.walletAddress, walletAddress));

  await db.insert(transactions).values({
    walletAddress,
    type: 'topup',
    amountUsd: amount.toFixed(8),
    txSignature,
    balanceBefore: oldBalance.toFixed(8),
    balanceAfter: newBalance.toFixed(8),
  });

  return { newBalance };
}
