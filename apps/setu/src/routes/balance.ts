import { Hono } from 'hono';
import { walletAuth } from '../middleware/auth';
import { getOrCreateUser } from '../services/balance';

type Variables = { walletAddress: string };

const balance = new Hono<{ Variables: Variables }>();

balance.get('/v1/balance', walletAuth, async (c) => {
  const walletAddress = c.get('walletAddress');
  const user = await getOrCreateUser(walletAddress);

  return c.json({
    wallet_address: user.walletAddress,
    balance_usd: parseFloat(user.balanceUsd),
    total_spent: parseFloat(user.totalSpent),
    total_topups: parseFloat(user.totalTopups),
    request_count: user.requestCount,
    created_at: user.createdAt,
    last_request: user.lastRequest,
  });
});

export default balance;
