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
});
