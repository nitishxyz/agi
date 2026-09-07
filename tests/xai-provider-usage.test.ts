import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test';
import { fetchXaiGrokUsage } from '../packages/server/src/routes/provider-usage/fetchers.ts';

const fetchSpy = spyOn(globalThis, 'fetch');
afterEach(() => fetchSpy.mockReset());
afterAll(() => fetchSpy.mockRestore());

function mockConfig(config: Record<string, unknown>) {
	fetchSpy.mockResolvedValue(Response.json({ config }));
}

describe('xAI credits usage', () => {
	test('requests credits and uses the reported percentage and current period', async () => {
		mockConfig({
			creditUsagePercent: 66,
			monthlyLimit: { val: 0 },
			used: { val: 0 },
			currentPeriod: {
				type: 'USAGE_PERIOD_TYPE_WEEKLY',
				start: '2026-09-02T00:00:00Z',
				end: '2026-09-09T00:00:00Z',
			},
			billingPeriodStart: '2026-09-01T00:00:00Z',
			billingPeriodEnd: '2026-10-01T00:00:00Z',
		});
		const usage = await fetchXaiGrokUsage('test-access');
		expect(fetchSpy).toHaveBeenCalledWith(
			'https://cli-chat-proxy.grok.com/v1/billing?format=credits',
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: 'Bearer test-access',
				}),
			}),
		);
		expect(usage.primaryWindow).toEqual({
			usedPercent: 66,
			windowSeconds: 604800,
			resetsAt: '2026-09-09T00:00:00Z',
		});
		expect(usage.limitReached).toBe(false);
	});

	test('accepts genuine zero usage and falls back to billing dates', async () => {
		mockConfig({
			creditUsagePercent: 0,
			billingPeriodStart: '2026-09-01T00:00:00Z',
			billingPeriodEnd: '2026-10-01T00:00:00Z',
		});
		const usage = await fetchXaiGrokUsage('test-access');
		expect(usage.primaryWindow.usedPercent).toBe(0);
		expect(usage.primaryWindow.windowSeconds).toBe(2592000);
		expect(usage.primaryWindow.resetsAt).toBe('2026-10-01T00:00:00Z');
	});

	test.each([undefined, null, '66', Number.NaN])(
		'rejects unavailable or invalid usage: %s',
		async (creditUsagePercent) => {
			mockConfig({ creditUsagePercent });
			await expect(fetchXaiGrokUsage('test-access')).rejects.toThrow(
				'invalid credit usage',
			);
		},
	);

	test.each([
		[100, 0, 0, 100, true],
		[120, 0, 0, 100, true],
		[100, 10, 0, 100, false],
		[100, 0, 10, 100, false],
		[-5, 0, 0, 0, false],
	])(
		'maps usage %s with cap %s and prepaid %s',
		async (percent, cap, prepaid, expected, reached) => {
			mockConfig({
				creditUsagePercent: percent,
				onDemandCap: { val: cap },
				prepaidBalance: { val: prepaid },
			});
			const usage = await fetchXaiGrokUsage('test-access');
			expect(usage.primaryWindow.usedPercent).toBe(expected);
			expect(usage.limitReached).toBe(reached);
		},
	);

	test('does not expose invalid reset dates', async () => {
		mockConfig({ creditUsagePercent: 12, currentPeriod: { end: 'invalid' } });
		const usage = await fetchXaiGrokUsage('test-access');
		expect(usage.primaryWindow.resetsAt).toBeNull();
		expect(usage.primaryWindow.windowSeconds).toBe(2592000);
	});

	test('reports HTTP errors', async () => {
		fetchSpy.mockResolvedValue(new Response(null, { status: 401 }));
		await expect(fetchXaiGrokUsage('test-access')).rejects.toThrow(
			'xAI Grok billing API returned 401',
		);
	});
});
