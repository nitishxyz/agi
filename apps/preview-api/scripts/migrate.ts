import { Resource } from 'sst';
import { $ } from 'bun';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dir, '../drizzle');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!ACCOUNT_ID) {
	console.error('CLOUDFLARE_ACCOUNT_ID env var is required');
	process.exit(1);
}

async function migrate() {
	console.log('Running D1 migrations...\n');

	const dbId = Resource.PreviewDB.databaseId;

	console.log('Finding database name...\n');
	process.env.CLOUDFLARE_ACCOUNT_ID = ACCOUNT_ID;

	const result = await $`bunx wrangler d1 list --json`.text();
	const databases = JSON.parse(result);

	const db = databases.find(
		(d: { uuid: string; name: string }) => d.uuid === dbId,
	);
	if (!db) {
		console.error(`Database with ID ${dbId} not found`);
		console.log(
			'Available databases:',
			databases
				.map((d: { uuid: string; name: string }) => `${d.name} (${d.uuid})`)
				.join('\n'),
		);
		process.exit(1);
	}

	const dbName = db.name;
	console.log(`Database Name: ${dbName}`);
	console.log(`Database ID: ${dbId}\n`);

	const files = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith('.sql'))
		.sort();

	if (files.length === 0) {
		console.log('No migration files found.');
		return;
	}

	for (const file of files) {
		const filePath = join(MIGRATIONS_DIR, file);

		console.log(`Applying: ${file}`);

		await $`bunx wrangler d1 execute ${dbName} --file=${filePath} --remote -y`.quiet();

		console.log(`✓ Applied: ${file}\n`);
	}

	console.log('All migrations applied successfully!');
}

migrate().catch((err) => {
	console.error('Migration failed:', err);
	process.exit(1);
});
