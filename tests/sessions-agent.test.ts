import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { registerSessionsRoutes } from '@/server/routes/sessions.ts';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function createRequest(url: string, body: unknown) {
	return new Request(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
}

describe('session creation respects agent provider/model', () => {
	it('uses agent provider/model when request omits them', async () => {
		const root = await mkdtemp(join(tmpdir(), 'agi-session-'));
		const projectRoot = join(root, 'project');
		const homeDir = join(root, 'home');
		await mkdir(projectRoot, { recursive: true });
		await mkdir(homeDir, { recursive: true });
		const prevHome = process.env.HOME;
		const prevProfile = process.env.USERPROFILE;
		const prevXdg = process.env.XDG_CONFIG_HOME;
		const prevAnthropic = process.env.ANTHROPIC_API_KEY;
		process.env.HOME = homeDir;
		process.env.USERPROFILE = homeDir;
		process.env.XDG_CONFIG_HOME = join(homeDir, '.config');
		process.env.ANTHROPIC_API_KEY = 'test-key';
		try {
			const projectAgi = join(projectRoot, '.agi');
			await mkdir(projectAgi, { recursive: true });
			await writeFile(
				join(projectAgi, 'agents.json'),
				JSON.stringify({
					coder: {
						provider: 'anthropic',
						model: 'claude-3-5-sonnet-20241022',
					},
				}),
			);
			const app = new Hono();
			registerSessionsRoutes(app);
			const req = await createRequest(
				`http://test/v1/sessions?project=${encodeURIComponent(projectRoot)}`,
				{ title: null, agent: 'coder' },
			);
			const res = await app.fetch(req);
			expect(res.status).toBe(201);
			const data = (await res.json()) as Record<string, unknown>;
			expect(data.agent).toBe('coder');
			expect(data.provider).toBe('anthropic');
			expect(data.model).toBe('claude-3-5-sonnet-20241022');
		} finally {
			if (prevHome === undefined) delete process.env.HOME;
			else process.env.HOME = prevHome;
			if (prevProfile === undefined) delete process.env.USERPROFILE;
			else process.env.USERPROFILE = prevProfile;
			if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
			else process.env.XDG_CONFIG_HOME = prevXdg;
			if (prevAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
			else process.env.ANTHROPIC_API_KEY = prevAnthropic;
			await rm(root, { recursive: true, force: true });
		}
	});
});
