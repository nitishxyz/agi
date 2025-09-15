import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { loadConfig } from '@/config/index.ts';
import * as schema from '@/db/schema/index.ts';
import { bundledMigrations } from '@/runtime/migrations-bundled.ts';

let dbCache: Map<string, BunSQLiteDatabase<typeof schema>> = new Map();
let migratedPaths = new Set<string>();

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
      const metaPath = `${cfg.projectRoot}/drizzle/meta/0000_snapshot.json`;
      const hasFolder = await Bun.file(metaPath).exists();
      if (hasFolder) {
        await migrate(db, { migrationsFolder: `${cfg.projectRoot}/drizzle` });
        // console.log('✅ Database migrations completed (folder)');
      } else {
        // Bundled mode: apply embedded SQL files if tables aren't present
        const haveSessions = sqlite
          .query("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
          .get() as { name?: string } | undefined;
        if (!haveSessions?.name) {
          for (const m of bundledMigrations) {
            const sql = await Bun.file(m.path).text();
            sqlite.exec(sql);
          }
        }
        // console.log('✅ Database migrations completed (bundled)');
      }
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
