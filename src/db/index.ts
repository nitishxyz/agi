import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { loadConfig } from '@/config/index.ts';
import * as schema from '@/db/schema/index.ts';
import { bundledMigrations } from '@/runtime/migrations-bundled.ts';

const dbCache: Map<string, BunSQLiteDatabase<typeof schema>> = new Map();
const migratedPaths = new Set<string>();

export async function getDb(projectRootInput?: string) {
	const cfg = await loadConfig(projectRootInput);
	const dbPath = cfg.paths.dbPath;
	// Data dir is ensured by loadConfig() already.

	const key = dbPath;
	const cached = dbCache.get(key);
	if (cached) return cached;

	const sqlite = new Database(dbPath, { create: true });
	const db = drizzle(sqlite, { schema });

	// Run migrations once per db path
	if (!migratedPaths.has(dbPath)) {
		try {
			// Check if sessions table exists
			const haveSessions = sqlite
				.query(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
				)
				.get() as { name?: string } | undefined;

			if (!haveSessions?.name) {
				// Apply bundled migrations in a transaction
				sqlite.exec('BEGIN TRANSACTION');
				try {
					for (const m of bundledMigrations) {
						sqlite.exec(m.content);
					}
					sqlite.exec('COMMIT');
				} catch (err) {
					sqlite.exec('ROLLBACK');
					throw err;
				}
			}
			migratedPaths.add(dbPath);
		} catch (error) {
			console.error('❌ Local database migration failed:', error);
			// Don't add to migratedPaths if migration failed
			throw error; // Re-throw to prevent using a partially migrated database
		}
	}
	dbCache.set(key, db);
	return db;
}

export type DB = Awaited<ReturnType<typeof getDb>>;
export * as dbSchema from './schema/index.ts';
