import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'bun:test';
import { loadConfig, setConfig } from '@ottocode/sdk';
import { createEmbeddedApp } from '../packages/server/src/index.js';

describe('config loader', () => {
	it('loads defaults when no config files present', async () => {
		const tmpProject = process.cwd();
		const cfg = await loadConfig(tmpProject);
		expect(cfg.projectRoot).toBe(tmpProject);
		expect(cfg.defaults.agent).toBeDefined();
		expect(cfg.defaults.provider).toBeDefined();
		expect(cfg.defaults.model).toBeDefined();
		expect(cfg.defaults.fullWidthContent).toBe(true);
		expect(cfg.paths.dbPath.endsWith('.otto/otto.sqlite')).toBe(true);
	});

	it('persists full width content in config defaults', async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), 'otto-config-'));

		try {
			await setConfig(
				'local',
				{
					fullWidthContent: true,
				},
				projectRoot,
			);

			const cfg = await loadConfig(projectRoot);
			expect(cfg.defaults.fullWidthContent).toBe(true);
		} finally {
			await rm(projectRoot, { recursive: true, force: true });
		}
	});

	it('exposes and updates full width content through config routes', async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), 'otto-config-route-'));
		const app = createEmbeddedApp();

		try {
			const updateResponse = await app.request(
				`http://localhost/v1/config/defaults?project=${encodeURIComponent(projectRoot)}`,
				{
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						fullWidthContent: true,
						scope: 'local',
					}),
				},
			);

			expect(updateResponse.status).toBe(200);
			const updatePayload = await updateResponse.json();
			expect(updatePayload.defaults.fullWidthContent).toBe(true);

			const getResponse = await app.request(
				`http://localhost/v1/config?project=${encodeURIComponent(projectRoot)}`,
			);
			expect(getResponse.status).toBe(200);

			const getPayload = await getResponse.json();
			expect(getPayload.defaults.fullWidthContent).toBe(true);
		} finally {
			await rm(projectRoot, { recursive: true, force: true });
		}
	});
});
