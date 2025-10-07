import { defineConfig } from 'drizzle-kit';
import { getLocalDataDir } from '@agi-cli/sdk';

const dataDir = getLocalDataDir(process.cwd());
const dbPath = `${dataDir}/agi.db`;

export default defineConfig({
	dialect: 'sqlite',
	schema: './src/schema.ts',
	out: './drizzle',
	dbCredentials: {
		url: dbPath,
	},
});
