import { mkdir, rm, writeFile, readFile, cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from 'bun';

const packageDir = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(packageDir, 'dist');
const rootDir = join(packageDir, '..', '..');

const entries = [
	{ source: 'src/index.ts', output: 'index.js', dts: 'index.d.ts' },
	{
		source: 'src/tools/builtin/fs.ts',
		output: 'tools/builtin/fs.js',
		dts: 'tools/builtin/fs.d.ts',
	},
	{
		source: 'src/tools/builtin/git.ts',
		output: 'tools/builtin/git.js',
		dts: 'tools/builtin/git.d.ts',
	},
	{ source: 'src/web-ui.ts', output: 'web-ui.js', dts: 'web-ui.d.ts' },
];

await rm(distDir, { recursive: true, force: true });

const buildResult = await Bun.build({
	entrypoints: entries.map((entry) => join(packageDir, entry.source)),
	outdir: distDir,
	target: 'bun',
	format: 'esm',
	sourcemap: 'external',
	minify: false,
	external: ['@agi-cli/web-ui'],
});

if (!buildResult.success) {
	for (const log of buildResult.logs) {
		console.error(log.message);
	}
	throw new Error('SDK bundling failed');
}

const typesOutDir = join(packageDir, 'dist-types');
await rm(typesOutDir, { recursive: true, force: true });

const typeBuild =
	await $`bunx tsc --project ${join(packageDir, 'tsconfig.bundle.json')}`
		.cwd(packageDir)
		.nothrow();

if (typeBuild.exitCode !== 0) {
	throw new Error('Type declaration build failed');
}

async function copyType(relativeSource: string, relativeTarget: string) {
	const sourcePath = join(typesOutDir, relativeSource);
	const targetPath = join(distDir, relativeTarget);
	await mkdir(dirname(targetPath), { recursive: true });
	await cp(sourcePath, targetPath, { recursive: true });
}

await copyType('sdk/src/index.d.ts', 'index.d.ts');
await copyType('sdk/src/tools/builtin/fs.d.ts', 'tools/builtin/fs.d.ts');
await copyType('sdk/src/tools/builtin/git.d.ts', 'tools/builtin/git.d.ts');
await copyType('sdk/src/web-ui.d.ts', 'web-ui.d.ts');

await rm(typesOutDir, { recursive: true, force: true });

const rawPackage = JSON.parse(
	await readFile(join(packageDir, 'package.json'), 'utf8'),
) as Record<string, unknown>;

const dependencies = Object.fromEntries(
	Object.entries(
		(rawPackage.dependencies ?? {}) as Record<string, string>,
	).filter(([name]) => !name.startsWith('@agi-cli/')),
);

const publishPackage = {
	name: rawPackage.name,
	version: rawPackage.version,
	description: rawPackage.description,
	author: rawPackage.author,
	license: rawPackage.license,
	homepage: rawPackage.homepage,
	repository: rawPackage.repository,
	bugs: rawPackage.bugs,
	type: 'module',
	main: './index.js',
	module: './index.js',
	types: './index.d.ts',
	exports: {
		'.': {
			import: './index.js',
			types: './index.d.ts',
		},
		'./tools/builtin/fs': {
			import: './tools/builtin/fs.js',
			types: './tools/builtin/fs.d.ts',
		},
		'./tools/builtin/git': {
			import: './tools/builtin/git.js',
			types: './tools/builtin/git.d.ts',
		},
		'./web-ui': {
			import: './web-ui.js',
			types: './web-ui.d.ts',
		},
	},
	keywords: rawPackage.keywords,
	dependencies: Object.keys(dependencies).length ? dependencies : undefined,
};

if (!publishPackage.dependencies) {
	delete publishPackage.dependencies;
}

await writeFile(
	join(distDir, 'package.json'),
	`${JSON.stringify(publishPackage, null, 2)}\n`,
);

const filesToCopy = [
	{ from: join(packageDir, 'README.md'), to: join(distDir, 'README.md') },
	{ from: join(rootDir, 'LICENSE'), to: join(distDir, 'LICENSE') },
];

for (const file of filesToCopy) {
	const data = await readFile(file.from, 'utf8');
	await writeFile(file.to, data);
}

console.log('✓ Built sdk bundle into dist/');
console.log('  Publish with: bun publish packages/sdk/dist');
