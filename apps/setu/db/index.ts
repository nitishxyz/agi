import { drizzle } from 'drizzle-orm/neon-http';
import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from './schema';

neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(DATABASE_URL);

export const db = drizzle({ client: sql, schema });
