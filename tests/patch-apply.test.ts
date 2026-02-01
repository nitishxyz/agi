import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyPatchOperations } from '../packages/sdk/src/core/src/tools/builtin/patch/apply.ts';
import { parseEnvelopedPatch } from '../packages/sdk/src/core/src/tools/builtin/patch/parse-enveloped.ts';

let projectRoot: string;

beforeEach(async () => {
	projectRoot = await mkdtemp(join(tmpdir(), 'patch-test-'));
});

afterEach(async () => {
	await rm(projectRoot, { recursive: true, force: true });
});

async function writeTestFile(name: string, content: string) {
	await writeFile(join(projectRoot, name), content, 'utf-8');
}

async function readTestFile(name: string) {
	return readFile(join(projectRoot, name), 'utf-8');
}

async function applyPatch(patch: string, opts?: { useFuzzy?: boolean; allowRejects?: boolean }) {
	const operations = parseEnvelopedPatch(patch);
	return applyPatchOperations(projectRoot, operations, {
		useFuzzy: opts?.useFuzzy ?? true,
		allowRejects: opts?.allowRejects ?? false,
	});
}

describe('patch apply — stale context rejection', () => {
	it('rejects patch when context line has extra content (the || bug)', async () => {
		await writeTestFile(
			'test.ts',
			[
				'if (',
				'\texistsSync("a.txt") ||',
				'\texistsSync("b.txt")',
				') {',
				'\tresult = "found";',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: test.ts',
			'@@ add more checks',
			' if (',
			' \texistsSync("a.txt") ||',
			' \texistsSync("b.txt") ||',
			'+\texistsSync("c.txt") ||',
			'+\texistsSync("d.txt")',
			' ) {',
			' \tresult = "found";',
			'*** End Patch',
		].join('\n');

		expect(() => applyPatch(patch)).toThrow('Failed to apply patch hunk');
	});

	it('rejects patch when context line content differs (not just whitespace)', async () => {
		await writeTestFile(
			'app.ts',
			[
				'function greet(name: string) {',
				'  return "Hello, " + name;',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: app.ts',
			' function greet(name: string) {',
			'-  return "Hello, " + name;',
			'+  return `Hello, ${name}!`;',
			'-}',
			'+}',
			'*** End Patch',
		].join('\n');

		const result = await applyPatch(patch);
		const content = await readTestFile('app.ts');
		expect(content).toContain('`Hello, ${name}!`');
	});

	it('applies patch correctly when context matches exactly', async () => {
		await writeTestFile(
			'test.ts',
			[
				'if (',
				'\texistsSync("a.txt") ||',
				'\texistsSync("b.txt")',
				') {',
				'\tresult = "found";',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: test.ts',
			'@@ add more checks',
			' if (',
			' \texistsSync("a.txt") ||',
			' \texistsSync("b.txt")',
			'+\texistsSync("c.txt")',
			' ) {',
			' \tresult = "found";',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('test.ts');
		expect(content).toContain('existsSync("c.txt")');
		expect(content).toContain('result = "found"');
	});

	it('does not blindly insert additions at wrong location', async () => {
		await writeTestFile(
			'config.ts',
			[
				'const config = {',
				'  host: "localhost",',
				'  port: 3000,',
				'};',
				'',
				'export default config;',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: config.ts',
			' const config = {',
			' \thost: "localhost",',
			' \tport: 3000,',
			' \ttimeout: 5000,',
			'+\tretries: 3,',
			' };',
			'*** End Patch',
		].join('\n');

		expect(() => applyPatch(patch)).toThrow('Failed to apply patch hunk');
	});

	it('allows rejects mode to skip bad hunks without breaking file', async () => {
		await writeTestFile(
			'test.ts',
			[
				'if (',
				'\texistsSync("a.txt") ||',
				'\texistsSync("b.txt")',
				') {',
				'\tresult = "found";',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: test.ts',
			'@@ wrong context',
			' if (',
			' \texistsSync("a.txt") ||',
			' \texistsSync("b.txt") ||',
			'+\texistsSync("c.txt")',
			' ) {',
			'*** End Patch',
		].join('\n');

		const result = await applyPatch(patch, { allowRejects: true });
		expect(result.rejected.length).toBe(1);
		const content = await readTestFile('test.ts');
		expect(content).not.toContain('existsSync("c.txt")');
		expect(content).toContain('existsSync("b.txt")');
	});

	it('still applies pure addition hunks without context', async () => {
		await writeTestFile('hello.ts', 'const x = 1;\n');

		const patch = [
			'*** Begin Patch',
			'*** Update File: hello.ts',
			'+const y = 2;',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('hello.ts');
		expect(content).toContain('const y = 2;');
	});

	it('detects already-applied additions and skips without error', async () => {
		await writeTestFile(
			'test.ts',
			[
				'if (',
				'\texistsSync("a.txt") ||',
				'\texistsSync("b.txt") ||',
				'\texistsSync("c.txt")',
				') {',
				'\tresult = "found";',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: test.ts',
			' if (',
			' \texistsSync("a.txt") ||',
			' \texistsSync("b.txt") ||',
			'+\texistsSync("c.txt")',
			' ) {',
			'*** End Patch',
		].join('\n');

		const result = await applyPatch(patch);
		const content = await readTestFile('test.ts');
		expect(content).toContain('existsSync("c.txt")');
	});
});
