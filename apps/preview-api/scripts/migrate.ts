import { Resource } from 'sst';
import { $ } from 'bun';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dir, '../drizzle');

// Set your Cloudflare account ID here or via CLOUDFLARE_ACCOUNT_ID env var
const ACCOUNT_ID =
	process.env.CLOUDFLARE_ACCOUNT_ID || '861f82c965197980de430263380bad71';

async function migrate() {
	console.log('Running D1 migrations...\n');

	// SST names databases as: {app}-{stage}-{resourceName}
	// We can get the database ID and use wrangler API, or construct the name
	const dbId = Resource.PreviewDB.databaseId;

	// First, let's list databases to find the name
	console.log('Finding database name...\n');
	process.env.CLOUDFLARE_ACCOUNT_ID = ACCOUNT_ID;

	const result = await $`wrangler d1 list --json`.text();
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

	// Get all SQL migration files sorted by name
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

		// Use wrangler with database name as positional arg
		await $`wrangler d1 execute ${dbName} --file=${filePath} --remote -y`.quiet();

		console.log(`✓ Applied: ${file}\n`);
	}

	console.log('All migrations applied successfully!');
}

migrate().catch((err) => {
	console.error('Migration failed:', err);
	process.exit(1);
});
