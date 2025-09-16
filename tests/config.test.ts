import { describe, expect, it } from 'bun:test';
import { loadConfig } from '../src/config/index.ts';

describe('config loader', () => {
	it('loads defaults when no config files present', async () => {
		const tmpProject = process.cwd();
		const cfg = await loadConfig(tmpProject);
		expect(cfg.projectRoot).toBe(tmpProject);
		expect(cfg.defaults.agent).toBeDefined();
		expect(cfg.defaults.provider).toBeDefined();
		expect(cfg.defaults.model).toBeDefined();
		expect(cfg.paths.dbPath.endsWith('.agi/agi.sqlite')).toBe(true);
	});
});
