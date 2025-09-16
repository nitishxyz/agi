import { loadConfig } from '@/config/index.ts';

async function main() {
	const cfg = await loadConfig(process.cwd());
	const f = Bun.file(cfg.paths.dbPath);
	if (await f.exists()) {
		const { promises: fs } = await import('node:fs');
		try {
			await fs.unlink(cfg.paths.dbPath);
			console.log(`Deleted DB at ${cfg.paths.dbPath}`);
		} catch (err) {
			console.error(`Could not delete DB: ${cfg.paths.dbPath}`, err);
		}
	} else {
		console.log(`No DB at ${cfg.paths.dbPath}`);
	}
}

main();
