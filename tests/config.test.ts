import { describe, expect, it } from 'bun:test';
import { loadConfig } from '../src/config/index.ts';
import path from 'node:path';

describe('config loader', () => {
	it('loads defaults when no config files present', async () => {
		const tmpProject = path.resolve('.');
		const cfg = await loadConfig(tmpProject);
		expect(cfg.projectRoot).toBe(tmpProject);
		expect(cfg.defaults.agent).toBeDefined();
		expect(cfg.defaults.provider).toBeDefined();
		expect(cfg.defaults.model).toBeDefined();
		expect(cfg.paths.dbPath.endsWith('.agi/agi.sqlite')).toBe(true);
	});
});
