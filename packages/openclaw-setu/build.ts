import { build } from 'bun';
import { renameSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const entrypoints = ['./src/index.ts', './src/cli.ts'];

const result = await build({
	entrypoints,
	outdir: './dist',
	target: 'node',
	format: 'esm',
	splitting: true,
	sourcemap: 'none',
	external: [],
	minify: true,
});

if (!result.success) {
	console.error('Build failed:');
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

const distDir = './dist';
const jsFiles = readdirSync(distDir).filter((f) => f.endsWith('.js'));

for (const file of jsFiles) {
	const filePath = join(distDir, file);
	let content = readFileSync(filePath, 'utf-8');
	for (const other of jsFiles) {
		if (other === file) continue;
		const mjsName = other.replace(/\.js$/, '.mjs');
		content = content.replaceAll(`"./${other}"`, `"./${mjsName}"`);
		content = content.replaceAll(`'./${other}'`, `'./${mjsName}'`);
	}
	const newPath = join(distDir, file.replace(/\.js$/, '.mjs'));
	writeFileSync(newPath, content);
}

for (const file of jsFiles) {
	const { unlinkSync } = await import('node:fs');
	unlinkSync(join(distDir, file));
}

const mjsFiles = readdirSync(distDir).filter((f) => f.endsWith('.mjs'));
console.log(`Built ${mjsFiles.length} files to dist/`);
for (const f of mjsFiles) {
	const size = readFileSync(join(distDir, f)).length;
	console.log(`  ${f} (${(size / 1024).toFixed(1)}KB)`);
}
