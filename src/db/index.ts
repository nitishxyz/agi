import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '@/config/index.ts';
import * as schema from '@/db/schema/index.ts';

let dbCache: Map<string, BunSQLiteDatabase<typeof schema>> = new Map();
let migratedPaths = new Set<string>();

export async function getDb(projectRootInput?: string) {
	const cfg = await loadConfig(projectRootInput);
	const dbPath = cfg.paths.dbPath;
	await fs.mkdir(path.dirname(dbPath), { recursive: true }).catch(() => {});

	const key = dbPath;
	const cached = dbCache.get(key);
	if (cached) return cached;

	const sqlite = new Database(dbPath, { create: true });
	const db = drizzle(sqlite, { schema });

	// Run migrations once per db path
	if (!migratedPaths.has(dbPath)) {
		try {
			await migrate(db, { migrationsFolder: 'drizzle' });
			console.log('✅ Local database migrations completed');
			migratedPaths.add(dbPath);
		} catch (error) {
			console.error('❌ Local database migration failed:', error);
		}
	}
	dbCache.set(key, db);
	return db;
}

export type DB = Awaited<ReturnType<typeof getDb>>;
export * as dbSchema from './schema/index.ts';
