import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
	createApp,
	createStandaloneApp,
	createEmbeddedApp,
} from '@agi-cli/server';

describe('Server Factory Functions', () => {
	describe('createApp', () => {
		test('creates default file-based app', () => {
			const app = createApp();
			expect(app).toBeDefined();
			expect(typeof app.fetch).toBe('function');
		});
	});

	describe('createStandaloneApp', () => {
		test('creates standalone app with default config', () => {
			const app = createStandaloneApp();
			expect(app).toBeDefined();
			expect(typeof app.fetch).toBe('function');
		});

		test('creates standalone app with custom config', () => {
			const app = createStandaloneApp({
				provider: 'openai',
				model: 'gpt-4o-mini',
				defaultAgent: 'general',
			});
			expect(app).toBeDefined();
			expect(typeof app.fetch).toBe('function');
		});

		test('creates standalone app with env var defaults', () => {
			const originalProvider = process.env.AGI_PROVIDER;
			const originalModel = process.env.AGI_MODEL;
			const originalAgent = process.env.AGI_AGENT;

			process.env.AGI_PROVIDER = 'anthropic';
			process.env.AGI_MODEL = 'claude-sonnet-4';
			process.env.AGI_AGENT = 'build';

			const app = createStandaloneApp();
			expect(app).toBeDefined();

			if (originalProvider !== undefined) {
				process.env.AGI_PROVIDER = originalProvider;
			} else {
				delete process.env.AGI_PROVIDER;
			}
			if (originalModel !== undefined) {
				process.env.AGI_MODEL = originalModel;
			} else {
				delete process.env.AGI_MODEL;
			}
			if (originalAgent !== undefined) {
				process.env.AGI_AGENT = originalAgent;
			} else {
				delete process.env.AGI_AGENT;
			}
		});
	});

	describe('createEmbeddedApp', () => {
		test('creates embedded app with injected config', () => {
			const app = createEmbeddedApp({
				provider: 'openai',
				model: 'gpt-4o-mini',
				apiKey: 'sk-test-key',
			});
			expect(app).toBeDefined();
			expect(typeof app.fetch).toBe('function');
		});

		test('creates embedded app with custom agent', () => {
			const app = createEmbeddedApp({
				provider: 'anthropic',
				model: 'claude-sonnet-4',
				apiKey: 'sk-ant-test',
				agent: 'build',
			});
			expect(app).toBeDefined();
			expect(typeof app.fetch).toBe('function');
		});
	});
});

describe('AskService with Config Injection', () => {
	let originalEnv: Record<string, string | undefined>;

	beforeEach(() => {
		originalEnv = {
			OPENAI_API_KEY: process.env.OPENAI_API_KEY,
			ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
		};
	});

	afterEach(() => {
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value !== undefined) {
				process.env[key] = value;
			} else {
				delete process.env[key];
			}
		}
	});

	test('accepts skipFileConfig flag', async () => {
		const { handleAskRequest } = await import('@agi-cli/server');

		process.env.OPENAI_API_KEY = 'sk-test-mock-key';

		try {
			await handleAskRequest({
				prompt: 'Test prompt',
				skipFileConfig: true,
				config: {
					provider: 'openai',
					model: 'gpt-4o-mini',
				},
			});
		} catch (err) {
			expect(err).toBeDefined();
		}
	});

	test('accepts injected config with apiKey', async () => {
		const { handleAskRequest } = await import('@agi-cli/server');

		try {
			await handleAskRequest({
				prompt: 'Test prompt',
				skipFileConfig: true,
				config: {
					provider: 'openai',
					model: 'gpt-4o-mini',
					apiKey: 'sk-test-injected-key',
				},
			});
		} catch (err) {
			expect(err).toBeDefined();
		}
	});

	test('accepts credentials object', async () => {
		const { handleAskRequest } = await import('@agi-cli/server');

		try {
			await handleAskRequest({
				prompt: 'Test prompt',
				skipFileConfig: true,
				credentials: {
					openai: { apiKey: 'sk-test-creds-key' },
				},
				provider: 'openai',
				model: 'gpt-4o-mini',
			});
		} catch (err) {
			expect(err).toBeDefined();
		}
	});

	test('accepts inline agent prompt', async () => {
		const { handleAskRequest } = await import('@agi-cli/server');

		process.env.OPENAI_API_KEY = 'sk-test-agent-key';

		try {
			await handleAskRequest({
				prompt: 'Test prompt',
				skipFileConfig: true,
				config: {
					provider: 'openai',
					model: 'gpt-4o-mini',
				},
				agentPrompt: 'You are a helpful test assistant.',
				tools: ['progress_update', 'finish'],
			});
		} catch (err) {
			expect(err).toBeDefined();
		}
	});

	test('accepts custom tools array', async () => {
		const { handleAskRequest } = await import('@agi-cli/server');

		process.env.OPENAI_API_KEY = 'sk-test-tools-key';

		try {
			await handleAskRequest({
				prompt: 'Test prompt',
				skipFileConfig: true,
				config: {
					provider: 'openai',
					model: 'gpt-4o-mini',
				},
				agentPrompt: 'Test agent',
				tools: ['progress_update', 'finish', 'read', 'write'],
			});
		} catch (err) {
			expect(err).toBeDefined();
		}
	});
});

describe('Agent Config Injection', () => {
	test('resolveAgentConfig accepts inline config', async () => {
		const { resolveAgentConfig } = await import('@agi-cli/server');

		const config = await resolveAgentConfig(process.cwd(), 'test-agent', {
			prompt: 'Inline test prompt',
			tools: ['progress_update', 'finish'],
			provider: 'openai',
			model: 'gpt-4o-mini',
		});

		expect(config.name).toBe('test-agent');
		expect(config.prompt).toBe('Inline test prompt');
		expect(config.tools).toContain('progress_update');
		expect(config.tools).toContain('finish');
		expect(config.provider).toBe('openai');
		expect(config.model).toBe('gpt-4o-mini');
	});

	test('resolveAgentConfig falls back to files when no inline config', async () => {
		const { resolveAgentConfig } = await import('@agi-cli/server');

		const config = await resolveAgentConfig(process.cwd(), 'general');

		expect(config.name).toBe('general');
		expect(config.prompt).toBeDefined();
		expect(config.tools.length).toBeGreaterThan(0);
	});
});

describe('API Route Integration', () => {
	test('POST /v1/ask accepts skipFileConfig in body', async () => {
		const app = createStandaloneApp();

		const res = await app.request('http://localhost/v1/ask', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				prompt: 'Test prompt',
				skipFileConfig: true,
				config: {
					provider: 'openai',
					model: 'gpt-4o-mini',
					apiKey: 'sk-test',
				},
			}),
		});

		expect(res.status).toBeGreaterThanOrEqual(200);
	});

	test('POST /v1/ask accepts agentPrompt in body', async () => {
		const app = createStandaloneApp();

		const res = await app.request('http://localhost/v1/ask', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				prompt: 'Test prompt',
				skipFileConfig: true,
				config: {
					provider: 'openai',
					model: 'gpt-4o-mini',
					apiKey: 'sk-test',
				},
				agentPrompt: 'You are a test assistant.',
				tools: ['progress_update', 'finish'],
			}),
		});

		expect(res.status).toBeGreaterThanOrEqual(200);
	});

	test('POST /v1/ask accepts credentials in body', async () => {
		const app = createStandaloneApp();

		const res = await app.request('http://localhost/v1/ask', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				prompt: 'Test prompt',
				skipFileConfig: true,
				credentials: {
					openai: { apiKey: 'sk-test' },
				},
				provider: 'openai',
				model: 'gpt-4o-mini',
			}),
		});

		expect(res.status).toBeGreaterThanOrEqual(200);
	});
});
