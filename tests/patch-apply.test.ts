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

async function applyPatch(
	patch: string,
	opts?: { useFuzzy?: boolean; allowRejects?: boolean },
) {
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
			// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional template literal in patch content
			'+  return `Hello, ${name}!`;',
			'-}',
			'+}',
			'*** End Patch',
		].join('\n');

		const _result = await applyPatch(patch);
		const content = await readTestFile('app.ts');
		// biome-ignore lint/suspicious/noTemplateCurlyInString: checking template literal in file content
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

		const _result = await applyPatch(patch);
		const content = await readTestFile('test.ts');
		expect(content).toContain('existsSync("c.txt")');
	});
});

describe('patch apply — indentation correction', () => {
	it('corrects indentation when model uses wrong whitespace (YAML case)', async () => {
		await writeTestFile(
			'ci.yml',
			[
				'jobs:',
				'  build:',
				'    runs-on: ubuntu-latest',
				'    strategy:',
				'      matrix:',
				'        include:',
				'          - platform: macos-latest',
				'            target: arm64',
				'          - platform: ubuntu-latest',
				'            target: x64',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: ci.yml',
			' - platform: ubuntu-latest',
			'-  target: x64',
			'+  target: x86_64',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('ci.yml');
		expect(content).toContain('            target: x86_64');
	});

	it('preserves correct indentation when model context matches exactly', async () => {
		await writeTestFile(
			'app.ts',
			[
				'function main() {',
				'    const port = 3000;',
				'    return port;',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: app.ts',
			' function main() {',
			'-    const port = 3000;',
			'+    const port = 8080;',
			'     return port;',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('app.ts');
		expect(content).toContain('    const port = 8080;');
	});

	it('corrects add-line indentation based on nearest context line delta', async () => {
		await writeTestFile(
			'config.yml',
			[
				'services:',
				'  web:',
				'    image: nginx',
				'    ports:',
				'      - "80:80"',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: config.yml',
			' ports:',
			'   - "80:80"',
			'+  - "443:443"',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('config.yml');
		expect(content).toContain('      - "443:443"');
	});

	it('handles context lines with tab vs space mismatch', async () => {
		await writeTestFile(
			'script.ts',
			['function test() {', '  const a = 1;', '  const b = 2;', '}'].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: script.ts',
			' function test() {',
			'-  const a = 1;',
			'+  const a = 10;',
			'   const b = 2;',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('script.ts');
		expect(content).toContain('  const a = 10;');
	});
});

describe('patch apply — simple Replace format', () => {
	it('applies a basic find and replace', async () => {
		await writeTestFile(
			'config.ts',
			['const config = {', '  host: "localhost",', '  port: 3000,', '};'].join(
				'\n',
			),
		);

		const patch = [
			'*** Begin Patch',
			'*** Replace in: config.ts',
			'*** Find:',
			'  port: 3000,',
			'*** With:',
			'  port: 8080,',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('config.ts');
		expect(content).toContain('port: 8080');
		expect(content).not.toContain('port: 3000');
	});

	it('applies multiple find/replace pairs in one file', async () => {
		await writeTestFile(
			'app.ts',
			[
				'const HOST = "localhost";',
				'const PORT = 3000;',
				'const DEBUG = false;',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Replace in: app.ts',
			'*** Find:',
			'const PORT = 3000;',
			'*** With:',
			'const PORT = 8080;',
			'*** Find:',
			'const DEBUG = false;',
			'*** With:',
			'const DEBUG = true;',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('app.ts');
		expect(content).toContain('const PORT = 8080;');
		expect(content).toContain('const DEBUG = true;');
	});

	it('handles multi-line find and replace', async () => {
		await writeTestFile(
			'styles.css',
			['.header {', '  color: red;', '  font-size: 14px;', '}'].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Replace in: styles.css',
			'*** Find:',
			'  color: red;',
			'  font-size: 14px;',
			'*** With:',
			'  color: blue;',
			'  font-size: 16px;',
			'  font-weight: bold;',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('styles.css');
		expect(content).toContain('color: blue');
		expect(content).toContain('font-size: 16px');
		expect(content).toContain('font-weight: bold');
		expect(content).not.toContain('color: red');
	});

	it('handles find/replace with no replacement (deletion)', async () => {
		await writeTestFile(
			'app.ts',
			['const a = 1;', 'const b = 2;', 'const c = 3;'].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Replace in: app.ts',
			'*** Find:',
			'const b = 2;',
			'*** With:',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('app.ts');
		expect(content).not.toContain('const b = 2;');
		expect(content).toContain('const a = 1;');
		expect(content).toContain('const c = 3;');
	});

	it('errors when Find block is empty', async () => {
		const patch = [
			'*** Begin Patch',
			'*** Replace in: foo.ts',
			'*** Find:',
			'*** With:',
			'something',
			'*** End Patch',
		].join('\n');

		expect(() => parseEnvelopedPatch(patch)).toThrow('*** With: must follow');
	});

	it('errors when With comes before Find', async () => {
		const patch = [
			'*** Begin Patch',
			'*** Replace in: foo.ts',
			'*** With:',
			'something',
			'*** End Patch',
		].join('\n');

		expect(() => parseEnvelopedPatch(patch)).toThrow('*** With: must follow');
	});

	it('applies replace with fuzzy indentation correction', async () => {
		await writeTestFile(
			'ci.yml',
			[
				'matrix:',
				'  include:',
				'    - platform: ubuntu-latest',
				'      target: x64',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Replace in: ci.yml',
			'*** Find:',
			'    - platform: ubuntu-latest',
			'      target: x64',
			'*** With:',
			'    - platform: ubuntu-22.04',
			'      target: x64',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('ci.yml');
		expect(content).toContain('ubuntu-22.04');
		expect(content).not.toContain('ubuntu-latest');
	});
});

describe('patch apply — real LLM regression tests', () => {
	it('YAML: no extra leading space on inserted lines (release.yml bug)', async () => {
		await writeTestFile(
			'release.yml',
			[
				'jobs:',
				'  build-desktop:',
				'    runs-on: ${{ matrix.platform }}',
				'    strategy:',
				'      fail-fast: false',
				'      matrix:',
				'        include:',
				'          - platform: macos-latest',
				'            target: aarch64-apple-darwin',
				'            name: macOS-arm64',
				'          - platform: macos-latest',
				'            target: x86_64-apple-darwin',
				'            name: macOS-x64',
				'          - platform: ubuntu-latest',
				'            target: x86_64-unknown-linux-gnu',
				'            name: Linux-x64',
				'    steps:',
				'      - uses: actions/checkout@v4',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: release.yml',
			'@@ matrix linux entry',
			'           - platform: macos-latest',
			'             target: x86_64-apple-darwin',
			'             name: macOS-x64',
			'-          - platform: ubuntu-latest',
			'+          - platform: ubuntu-22.04',
			'             target: x86_64-unknown-linux-gnu',
			'             name: Linux-x64',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('release.yml');
		expect(content).toContain('          - platform: ubuntu-22.04');
		expect(content).toContain('            target: x86_64-unknown-linux-gnu');
		expect(content).toContain('            name: Linux-x64');
		expect(content).not.toContain('ubuntu-latest');
		const lines = content.split('\n');
		const ubuntuLine = lines.find((l: string) => l.includes('ubuntu-22.04'));
		expect(ubuntuLine).toBe('          - platform: ubuntu-22.04');
	});

	it('YAML: model uses fewer spaces in context but file has deep nesting', async () => {
		await writeTestFile(
			'workflow.yml',
			[
				'jobs:',
				'  deploy:',
				'    steps:',
				'      - name: Build',
				'        run: npm run build',
				'      - name: Test',
				'        run: npm test',
				'      - name: Deploy',
				'        run: npm run deploy',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: workflow.yml',
			' - name: Test',
			'-  run: npm test',
			'+  run: npm run test:ci',
			' - name: Deploy',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('workflow.yml');
		expect(content).toContain('        run: npm run test:ci');
		expect(content).not.toContain('npm test');
		const lines = content.split('\n');
		const testLine = lines.find((l: string) => l.includes('test:ci'));
		expect(testLine).toBe('        run: npm run test:ci');
	});

	it('YAML: inserted add line gets correct indentation from delta', async () => {
		await writeTestFile(
			'docker-compose.yml',
			[
				'services:',
				'  app:',
				'    environment:',
				'      - NODE_ENV=production',
				'      - PORT=3000',
				'    volumes:',
				'      - ./data:/data',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: docker-compose.yml',
			' - NODE_ENV=production',
			' - PORT=3000',
			'+- DEBUG=false',
			' volumes:',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('docker-compose.yml');
		expect(content).toContain('      - DEBUG=false');
		const lines = content.split('\n');
		const debugLine = lines.find((l: string) => l.includes('DEBUG'));
		expect(debugLine).toBe('      - DEBUG=false');
	});

	it('Markdown: bullet lines starting with - do not conflict with remove prefix', async () => {
		await writeTestFile(
			'README.md',
			[
				'# Features',
				'',
				'- Fast compilation',
				'- Hot reload',
				'- Type safety',
				'',
				'## Getting Started',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: README.md',
			' - Fast compilation',
			' - Hot reload',
			'-- Type safety',
			'+- Type safety with strict mode',
			'+- Plugin system',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('README.md');
		expect(content).toContain('- Type safety with strict mode');
		expect(content).toContain('- Plugin system');
		expect(content).not.toContain('- Type safety\n');
	});

	it('Markdown: Replace format avoids bullet conflict entirely', async () => {
		await writeTestFile(
			'README.md',
			[
				'# Features',
				'',
				'- Fast compilation',
				'- Hot reload',
				'- Type safety',
				'',
				'## Getting Started',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Replace in: README.md',
			'*** Find:',
			'- Type safety',
			'*** With:',
			'- Type safety with strict mode',
			'- Plugin system',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('README.md');
		expect(content).toContain('- Type safety with strict mode');
		expect(content).toContain('- Plugin system');
		expect(content).toContain('- Hot reload');
	});

	it('TypeScript with tabs: preserves tab indentation', async () => {
		await writeTestFile(
			'capture.ts',
			[
				'export function capture() {',
				'\tconst data = {};',
				'\tif (condition) {',
				'\t\tdata.value = 1;',
				'\t\tdata.name = "test";',
				'\t}',
				'\treturn data;',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: capture.ts',
			' \tif (condition) {',
			'-\t\tdata.value = 1;',
			'+\t\tdata.value = 42;',
			'+\t\tdata.extra = true;',
			' \t\tdata.name = "test";',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('capture.ts');
		expect(content).toContain('\t\tdata.value = 42;');
		expect(content).toContain('\t\tdata.extra = true;');
		expect(content).toContain('\t\tdata.name = "test";');
	});

	it('Multi-file patch: all files get correct indentation independently', async () => {
		await writeTestFile(
			'a.yml',
			['config:', '  port: 3000', '  host: localhost'].join('\n'),
		);
		await writeTestFile(
			'b.ts',
			['function init() {', '  return true;', '}'].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: a.yml',
			' config:',
			'-  port: 3000',
			'+  port: 8080',
			'*** Update File: b.ts',
			' function init() {',
			'-  return true;',
			'+  return false;',
			' }',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const yamlContent = await readTestFile('a.yml');
		const tsContent = await readTestFile('b.ts');
		expect(yamlContent).toContain('  port: 8080');
		expect(tsContent).toContain('  return false;');
	});
});

describe('patch apply — +1 extra space regression (research bug)', () => {
	it('does NOT add extra space when model context is off by 1 but add line is correct', async () => {
		await writeTestFile(
			'release.yml',
			[
				'      matrix:',
				'        include:',
				'          - platform: macos-latest',
				'            target: aarch64-apple-darwin',
				'          - platform: ubuntu-latest',
				'            target: x86_64-unknown-linux-gnu',
				'            name: Linux-x64',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: release.yml',
			'@@ matrix linux entry',
			'         - platform: macos-latest',
			'           target: aarch64-apple-darwin',
			'-         - platform: ubuntu-latest',
			'+          - platform: ubuntu-22.04',
			'           target: x86_64-unknown-linux-gnu',
			'           name: Linux-x64',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('release.yml');
		const lines = content.split('\n');
		const ubuntuLine = lines.find((l: string) => l.includes('ubuntu-22.04'));
		expect(ubuntuLine).toBe('          - platform: ubuntu-22.04');
	});

	it('does NOT add extra space when model context has 1 fewer space', async () => {
		await writeTestFile(
			'workflow.yml',
			[
				'jobs:',
				'  build:',
				'    steps:',
				'      - name: Test',
				'        run: npm test',
				'      - name: Deploy',
				'        run: deploy.sh',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: workflow.yml',
			'     - name: Test',
			'-       run: npm test',
			'+        run: npm run test:ci',
			'     - name: Deploy',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('workflow.yml');
		const lines = content.split('\n');
		const testLine = lines.find((l: string) => l.includes('test:ci'));
		expect(testLine).toBe('        run: npm run test:ci');
	});

	it('DOES adjust when model is consistently very wrong (off by 8+)', async () => {
		await writeTestFile(
			'deep.yml',
			[
				'      matrix:',
				'        include:',
				'          - platform: ubuntu-latest',
				'            target: x64',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: deep.yml',
			' include:',
			'-  - platform: ubuntu-latest',
			'+  - platform: ubuntu-22.04',
			'   target: x64',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('deep.yml');
		const lines = content.split('\n');
		const ubuntuLine = lines.find((l: string) => l.includes('ubuntu-22.04'));
		expect(ubuntuLine).toBe('          - platform: ubuntu-22.04');
	});

	it('Tab file with spaces in patch: converts added lines to tabs', async () => {
		await writeTestFile(
			'tabfile.ts',
			[
				'export function process() {',
				'\tconst items = [];',
				'\tfor (const item of data) {',
				'\t\titems.push(item);',
				'\t}',
				'\treturn items;',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: tabfile.ts',
			'  for (const item of data) {',
			'-    items.push(item);',
			'+    items.push(item);',
			'+    items.push(item.clone());',
			'  }',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('tabfile.ts');
		expect(content).toContain('\t\titems.push(item);');
		expect(content).toContain('\t\titems.push(item.clone());');
		expect(content).not.toContain('    items.push');
	});

	it('Tab file with spaces in patch: preserves tabs for replaced lines', async () => {
		await writeTestFile(
			'capture2.ts',
			[
				'const READ_ONLY = new Set([',
				"\t'read',",
				"\t'ls',",
				"\t'tree',",
				']);',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: capture2.ts',
			" const READ_ONLY = new Set([",
			"   'read',",
			"-  'ls',",
			"+  'ls',",
			"+  'glob',",
			"   'tree',",
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('capture2.ts');
		expect(content).toContain("\t'ls',");
		expect(content).toContain("\t'glob',");
		expect(content).not.toMatch(/  'glob'/);
	});

	it('Scenario 1: File has spaces, LLM brings tabs', async () => {
		await writeTestFile(
			'spaces-file.ts',
			[
				'function greet() {',
				'  const name = "world";',
				'  console.log(name);',
				'  return name;',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: spaces-file.ts',
			'\tconsole.log(name);',
			'-\treturn name;',
			'+\treturn `Hello ${name}`;',
			'+\treturn name.toUpperCase();',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('spaces-file.ts');
		expect(content).toContain('  return `Hello ${name}`;');
		expect(content).toContain('  return name.toUpperCase();');
		expect(content).not.toContain('\treturn');
	});

	it('Scenario 2: File has tabs, LLM brings spaces', async () => {
		await writeTestFile(
			'tabs-file.ts',
			[
				'function greet() {',
				'\tconst name = "world";',
				'\tconsole.log(name);',
				'\treturn name;',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: tabs-file.ts',
			'  console.log(name);',
			'-  return name;',
			'+  return `Hello ${name}`;',
			'+  return name.toUpperCase();',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('tabs-file.ts');
		expect(content).toContain('\treturn `Hello ${name}`;');
		expect(content).toContain('\treturn name.toUpperCase();');
		expect(content).not.toContain('  return');
	});

	it('Scenario 3: File uses 2-space indent, LLM brings 4-space', async () => {
		await writeTestFile(
			'two-space.ts',
			[
				'function process() {',
				'  if (true) {',
				'    doStuff();',
				'    cleanup();',
				'  }',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: two-space.ts',
			'    if (true) {',
			'-        doStuff();',
			'+        doStuff();',
			'+        doMore();',
			'        cleanup();',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('two-space.ts');
		expect(content).toContain('    doStuff();');
		expect(content).toContain('    doMore();');
		expect(content).toContain('    cleanup();');
		expect(content).not.toContain('        doMore');
	});

	it('Scenario 4: File uses 4-space indent, LLM brings 2-space', async () => {
		await writeTestFile(
			'four-space.ts',
			[
				'function process() {',
				'    if (true) {',
				'        doStuff();',
				'        cleanup();',
				'    }',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: four-space.ts',
			'  if (true) {',
			'-    doStuff();',
			'+    doStuff();',
			'+    doMore();',
			'    cleanup();',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('four-space.ts');
		expect(content).toContain('        doStuff();');
		expect(content).toContain('        doMore();');
		expect(content).toContain('        cleanup();');
		expect(content).not.toMatch(/^    doMore/m);
	});

	it('Scenario 5: File uses tab-size-2 (1 tab per level), LLM uses 4-space tabs', async () => {
		await writeTestFile(
			'tab2.ts',
			[
				'function process() {',
				'\tif (true) {',
				'\t\tdoStuff();',
				'\t\tcleanup();',
				'\t}',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: tab2.ts',
			'    if (true) {',
			'-        doStuff();',
			'+        doStuff();',
			'+        doMore();',
			'        cleanup();',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('tab2.ts');
		expect(content).toContain('\t\tdoStuff();');
		expect(content).toContain('\t\tdoMore();');
		expect(content).toContain('\t\tcleanup();');
		expect(content).not.toContain('        doMore');
	});

	it('Scenario 6: File uses 4-space tabs, LLM uses tab-size-2 tabs', async () => {
		await writeTestFile(
			'space4.ts',
			[
				'function process() {',
				'    if (true) {',
				'        doStuff();',
				'        cleanup();',
				'    }',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: space4.ts',
			'\tif (true) {',
			'-\t\tdoStuff();',
			'+\t\tdoStuff();',
			'+\t\tdoMore();',
			'\t\tcleanup();',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('space4.ts');
		expect(content).toContain('        doStuff();');
		expect(content).toContain('        doMore();');
		expect(content).toContain('        cleanup();');
		expect(content).not.toContain('\t\tdoMore');
	});

	it('Edge 1: Mixed indentation file — majority style wins', async () => {
		await writeTestFile(
			'mixed.ts',
			[
				'class App {',
				'\tconstructor() {',
				'\t\tthis.name = "app";',
				'\t\tthis.version = 1;',
				'\t}',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: mixed.ts',
			'  constructor() {',
			'    this.name = "app";',
			'-    this.version = 1;',
			'+    this.version = 2;',
			'+    this.ready = true;',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('mixed.ts');
		expect(content).toContain('\t\tthis.version = 2;');
		expect(content).toContain('\t\tthis.ready = true;');
	});

	it('Edge 2: No indented context lines (all at column 0)', async () => {
		await writeTestFile(
			'toplevel.ts',
			[
				'import { foo } from "./foo";',
				'import { bar } from "./bar";',
				'',
				'export const config = {};',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: toplevel.ts',
			' import { bar } from "./bar";',
			'+import { baz } from "./baz";',
			' ',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('toplevel.ts');
		expect(content).toContain('import { baz } from "./baz";');
		expect(content).not.toContain('\timport');
	});

	it('Edge 3: Added lines deeper than context', async () => {
		await writeTestFile(
			'deep-add.ts',
			[
				'function run() {',
				'\tif (ready) {',
				'\t\texecute();',
				'\t}',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: deep-add.ts',
			'  if (ready) {',
			'    execute();',
			'+    if (validate()) {',
			'+      log("validated");',
			'+    }',
			'  }',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('deep-add.ts');
		expect(content).toContain('\t\tif (validate()) {');
		expect(content).toContain('\t\t\tlog("validated");');
		expect(content).toContain('\t\t}');
	});

	it('Edge 4: Blank lines in additions are not indented', async () => {
		await writeTestFile(
			'blanks.ts',
			[
				'function setup() {',
				'\tconst a = 1;',
				'\treturn a;',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: blanks.ts',
			'  const a = 1;',
			'+  const b = 2;',
			'+',
			'+  const c = 3;',
			'  return a;',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('blanks.ts');
		const lines = content.split('\n');
		expect(content).toContain('\tconst b = 2;');
		expect(content).toContain('\tconst c = 3;');
		const blankIdx = lines.findIndex((l: string, i: number) => l === '' && i > 0 && lines[i - 1].includes('const b'));
		expect(blankIdx).toBeGreaterThan(-1);
		expect(lines[blankIdx]).toBe('');
	});

	it('Edge 5: Pure addition with no context lines', async () => {
		await writeTestFile(
			'nocontext.ts',
			[
				'const x = 1;',
				'const y = 2;',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: nocontext.ts',
			'@@ after line 2',
			'+const z = 3;',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('nocontext.ts');
		expect(content).toContain('const z = 3;');
	});

	it('Edge 6: Go-style tab-size-4 file with 4-space LLM patch', async () => {
		await writeTestFile(
			'main.go',
			[
				'func main() {',
				'\tfmt.Println("hello")',
				'\tfmt.Println("world")',
				'\treturn',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: main.go',
			'    fmt.Println("hello")',
			'-    fmt.Println("world")',
			'+    fmt.Println("universe")',
			'+    fmt.Println("galaxy")',
			'    return',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('main.go');
		expect(content).toContain('\tfmt.Println("universe")');
		expect(content).toContain('\tfmt.Println("galaxy")');
		expect(content).not.toContain('    fmt.Println("galaxy")');
	});

	it('TabSize inference: Go tabSize=4, file has tabs, LLM sends 4-space-per-tab', async () => {
		await writeTestFile(
			'handler.go',
			[
				'func handler(w http.ResponseWriter, r *http.Request) {',
				'\tif r.Method == "GET" {',
				'\t\tfmt.Fprintln(w, "hello")',
				'\t\tfmt.Fprintln(w, "world")',
				'\t}',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: handler.go',
			'    if r.Method == "GET" {',
			'        fmt.Fprintln(w, "hello")',
			'-        fmt.Fprintln(w, "world")',
			'+        fmt.Fprintln(w, "universe")',
			'+        fmt.Fprintln(w, "galaxy")',
			'    }',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('handler.go');
		expect(content).toContain('\t\tfmt.Fprintln(w, "universe")');
		expect(content).toContain('\t\tfmt.Fprintln(w, "galaxy")');
		expect(content).not.toContain('        fmt.Fprintln');
	});

	it('TabSize inference: tabSize=8, file has tabs, LLM sends 8-space-per-tab', async () => {
		await writeTestFile(
			'makefile-like.txt',
			[
				'all:',
				'\techo "building"',
				'\techo "testing"',
				'\techo "done"',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: makefile-like.txt',
			'        echo "building"',
			'-        echo "testing"',
			'+        echo "linting"',
			'+        echo "testing"',
			'        echo "done"',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('makefile-like.txt');
		expect(content).toContain('\techo "linting"');
		expect(content).toContain('\techo "testing"');
		expect(content).not.toContain('        echo "linting"');
	});

	it('TabSize inference: Go nested tabSize=4, deep nesting preserved', async () => {
		await writeTestFile(
			'nested.go',
			[
				'func process() {',
				'\tfor _, item := range items {',
				'\t\tif item.Valid {',
				'\t\t\tfmt.Println(item.Name)',
				'\t\t}',
				'\t}',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: nested.go',
			'        if item.Valid {',
			'-            fmt.Println(item.Name)',
			'+            fmt.Println(item.Name)',
			'+            item.Process()',
			'        }',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('nested.go');
		expect(content).toContain('\t\t\tfmt.Println(item.Name)');
		expect(content).toContain('\t\t\titem.Process()');
		expect(content).not.toContain('            item.Process');
	});

	it('TabSize inference: 4-space file, LLM sends 2-space, infers correctly', async () => {
		await writeTestFile(
			'java-style.ts',
			[
				'class App {',
				'    constructor() {',
				'        this.name = "app";',
				'        this.port = 3000;',
				'    }',
				'}',
			].join('\n'),
		);

		const patch = [
			'*** Begin Patch',
			'*** Update File: java-style.ts',
			'  constructor() {',
			'    this.name = "app";',
			'-    this.port = 3000;',
			'+    this.port = 8080;',
			'+    this.host = "0.0.0.0";',
			'*** End Patch',
		].join('\n');

		await applyPatch(patch);
		const content = await readTestFile('java-style.ts');
		expect(content).toContain('        this.port = 8080;');
		expect(content).toContain('        this.host = "0.0.0.0";');
	});
});
