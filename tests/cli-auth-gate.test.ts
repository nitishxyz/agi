import { afterEach, describe, expect, it, mock } from 'bun:test';

const loadConfigMock = mock(async () => ({
	projectRoot: '/tmp/project',
	defaults: { provider: 'openai' },
}));
const getAllAuthMock = mock(async () => ({}));
const getOnboardingCompleteMock = mock(async () => false);
const setOnboardingCompleteMock = mock(async () => {});
const isProviderAuthorizedMock = mock(async () => false);
const runAuthMock = mock(async () => true);

mock.module('@ottocode/sdk', () => ({
	loadConfig: loadConfigMock,
	getAllAuth: getAllAuthMock,
	getOnboardingComplete: getOnboardingCompleteMock,
	setOnboardingComplete: setOnboardingCompleteMock,
	isProviderAuthorized: isProviderAuthorizedMock,
}));

mock.module('@ottocode/cli/src/auth.ts', () => ({
	runAuth: runAuthMock,
}));

const withAuthModulePromise = import(
	'@ottocode/cli/src/middleware/with-auth.ts'
);

describe('cli auth gate onboarding', () => {
	afterEach(() => {
		delete process.env.OTTO_CI_MODE;
		delete process.env.CI;
		loadConfigMock.mockReset();
		loadConfigMock.mockImplementation(async () => ({
			projectRoot: '/tmp/project',
			defaults: { provider: 'openai' },
		}));
		getAllAuthMock.mockReset();
		getAllAuthMock.mockImplementation(async () => ({}));
		getOnboardingCompleteMock.mockReset();
		getOnboardingCompleteMock.mockImplementation(async () => false);
		setOnboardingCompleteMock.mockReset();
		isProviderAuthorizedMock.mockReset();
		isProviderAuthorizedMock.mockImplementation(async () => false);
		runAuthMock.mockReset();
		runAuthMock.mockImplementation(async () => true);
	});

	it('requires interactive auth on first run even when env auth already works', async () => {
		isProviderAuthorizedMock.mockImplementation(async (_cfg, provider) =>
			provider === 'openai' ? loadConfigMock.mock.calls.length > 1 : false,
		);

		const { ensureAuth } = await withAuthModulePromise;
		const result = await ensureAuth('/tmp/project');

		expect(runAuthMock).toHaveBeenCalledTimes(1);
		expect(setOnboardingCompleteMock).toHaveBeenCalledTimes(1);
		expect(result).toBe(true);
	});

	it('skips interactive auth after onboarding when env auth already works', async () => {
		getOnboardingCompleteMock.mockImplementation(async () => true);
		isProviderAuthorizedMock.mockImplementation(
			async (_cfg, provider) => provider === 'openai',
		);

		const { ensureAuth } = await withAuthModulePromise;
		const result = await ensureAuth('/tmp/project');

		expect(runAuthMock).toHaveBeenCalledTimes(0);
		expect(result).toBe(true);
	});

	it('bypasses onboarding in ci mode when env auth already works', async () => {
		process.env.OTTO_CI_MODE = '1';
		isProviderAuthorizedMock.mockImplementation(
			async (_cfg, provider) => provider === 'openai',
		);

		const { ensureAuth } = await withAuthModulePromise;
		const result = await ensureAuth('/tmp/project');

		expect(runAuthMock).toHaveBeenCalledTimes(0);
		expect(setOnboardingCompleteMock).toHaveBeenCalledTimes(0);
		expect(result).toBe(true);
	});

	it('fails cleanly in ci mode when no auth is available', async () => {
		process.env.OTTO_CI_MODE = '1';

		const { ensureAuth } = await withAuthModulePromise;
		const result = await ensureAuth('/tmp/project');

		expect(runAuthMock).toHaveBeenCalledTimes(0);
		expect(result).toBe(false);
	});
});
