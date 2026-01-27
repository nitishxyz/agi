import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from './config';
import models from './routes/models';
import balance from './routes/balance';
import topup from './routes/topup';
import messages from './routes/messages';
import responses from './routes/responses';
import completions from './routes/completions';

const app = new Hono();

app.use('*', logger());
app.use(
	'*',
	cors({
		origin: '*',
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowHeaders: ['*'],
		exposeHeaders: ['x-balance-remaining', 'x-cost-usd'],
	}),
);

app.get('/', (c) => {
	return c.json({
		service: 'setu.agi.nitish.sh',
		version: '0.1.0',
		status: 'online',
		description: 'AI Proxy powered by x402 payments',
		endpoints: {
			openai: '/v1/responses',
			anthropic: '/v1/messages',
			moonshot: '/v1/chat/completions',
			models: '/v1/models',
			balance: '/v1/balance',
			topup: '/v1/topup',
			health: '/health',
		},
	});
});

app.get('/health', (c) => {
	return c.json({
		status: 'ok',
		timestamp: new Date().toISOString(),
	});
});

app.route('/', models);
app.route('/', balance);
app.route('/', topup);
app.route('/', messages);
app.route('/', responses);
app.route('/', completions);

app.onError((err, c) => {
	console.error('Unhandled error:', err);
	return c.json({ error: err.message || 'Internal server error' }, 500);
});

export default {
	port: config.port,
	fetch: app.fetch,
	idleTimeout: 255,
};
