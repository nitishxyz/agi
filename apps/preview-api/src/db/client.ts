import { Resource } from 'sst';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function createDb() {
	return drizzle(Resource.PreviewDB, { schema });
}

export type Database = ReturnType<typeof createDb>;
