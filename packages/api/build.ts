#!/usr/bin/env bun
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

console.log('🏗️  Building @ottocode/api package...\n');

const distDir = join(import.meta.dir, 'dist');

// Step 1: Clean dist
if (existsSync(distDir)) {
	rmSync(distDir, { recursive: true, force: true });
}
mkdirSync(distDir, { recursive: true });

// Step 2: Generate OpenAPI client
console.log('📝 Generating API client from OpenAPI spec...');
const generate = Bun.spawnSync([process.execPath, 'run', 'generate.ts'], {
	cwd: import.meta.dir,
	stdout: 'inherit',
	stderr: 'inherit',
});

if (!generate.success) {
	console.error('❌ Failed to generate API client');
	process.exit(1);
}

// Step 3: Build TypeScript
console.log('\n📦 Building TypeScript...');
const build = Bun.spawnSync(
	[process.execPath, 'x', 'tsc', '--project', 'tsconfig.json'],
	{
		cwd: import.meta.dir,
		stdout: 'inherit',
		stderr: 'inherit',
	},
);

if (!build.success) {
	console.error('❌ Failed to build TypeScript');
	process.exit(1);
}

console.log('\n✅ Build complete!');
console.log(`   Package: ${distDir}`);
