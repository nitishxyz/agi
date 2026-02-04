import { describe, expect, test } from 'bun:test';
import {
	AskServiceError,
	// @ts-expect-error internal testing
	inferStatus as _inferStatus,
	// @ts-expect-error internal testing
	deriveStatusFromMessage as _derive,
} from '@ottocode/server';

describe('normalizeAskServiceError helpers', () => {
	test('respects explicit status on error object', () => {
		const err = Object.assign(new Error('boom'), { status: 418 });
		const status = _inferStatus(err as Error);
		expect(status).toBe(418);
	});

	test('maps known message patterns to status codes', () => {
		expect(_derive('Provider not configured')).toBe(401);
		expect(_derive('Request timeout while talking to upstream')).toBe(504);
		expect(_derive('session not found')).toBe(404);
	});

	test('falls back to 400 when no hints provided', () => {
		const err = new Error('strange problem');
		const normalized = new AskServiceError(err.message, _inferStatus(err));
		expect(normalized.status).toBe(400);
	});
});
