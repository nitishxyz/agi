import { describe, expect, test, mock } from 'bun:test';
import { Hono } from 'hono';

class AskServiceError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.name = 'AskServiceError';
		this.status = status;
	}
}

const handleAskRequestMock = mock(async () => {
	throw new AskServiceError('Unauthorized provider', 401);
});

mock.module('@agi-cli/server/runtime/ask/service.ts', () => ({
	handleAskRequest: handleAskRequestMock,
	AskServiceError,
}));

mock.module('packages/server/src/runtime/ask/service.ts', () => ({
	handleAskRequest: handleAskRequestMock,
	AskServiceError,
}));

// NOTE: These tests are skipped because Bun's mock.module doesn't work
// reliably with workspace package imports. The error handling logic is
// tested in ask-service-error.test.ts instead.
describe.skip('registerAskRoutes error handling', () => {
	test.skip('propagates AskServiceError status code', async () => {
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
		// Error response is now structured as { error: { message, type, status, code, details } }
		expect(payload.error).toBeDefined();
		expect(payload.error.message).toBe('Unauthorized provider');
		expect(payload.error.status).toBe(401);
	});

	test.skip('falls back to 400 for generic errors', async () => {
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
		// Error response is now structured as { error: { message, type, status, code, details } }
		expect(payload.error).toBeDefined();
		expect(payload.error.message).toBe('Boom');
	});
});
