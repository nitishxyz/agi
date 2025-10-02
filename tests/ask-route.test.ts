import { describe, expect, test, mock } from 'bun:test';
import { Hono } from 'hono';
import { AskServiceError } from '@agi-cli/server';

const handleAskRequestMock = mock(async () => {
	throw new AskServiceError('Unauthorized provider', 401);
});

mock.module('@agi-cli/server/runtime/ask-service.ts', () => ({
	handleAskRequest: handleAskRequestMock,
	AskServiceError,
}));

describe('registerAskRoutes error handling', () => {
	test('propagates AskServiceError status code', async () => {
		handleAskRequestMock.mockImplementationOnce(async () => {
			throw new AskServiceError('Unauthorized provider', 401);
		});
		const { registerAskRoutes } = await import('@agi-cli/server/routes/ask.ts');
		const app = new Hono();
		registerAskRoutes(app);

		const res = await app.request('http://localhost/v1/ask', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt: 'hello there' }),
		});

		expect(res.status).toBe(401);
		const payload = await res.json();
		expect(payload.error).toBe('Unauthorized provider');
	});

	test('falls back to 400 for generic errors', async () => {
		handleAskRequestMock.mockImplementationOnce(async () => {
			throw new Error('Boom');
		});
		const { registerAskRoutes } = await import('@agi-cli/server/routes/ask.ts');
		const app = new Hono();
		registerAskRoutes(app);

		const res = await app.request('http://localhost/v1/ask', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt: 'hi' }),
		});

		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.error).toBe('Boom');
	});
});
