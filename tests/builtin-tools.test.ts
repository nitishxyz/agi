import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverProjectTools } from '@agi-cli/sdk';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

let testDir: string;
let projectRoot: string;

beforeAll(async () => {
	testDir = await mkdtemp(join(tmpdir(), 'agi-tools-test-'));
	projectRoot = join(testDir, 'project');
	await mkdir(projectRoot, { recursive: true });

	// Initialize git repo for git tools
	await execAsync('git init', { cwd: projectRoot });
	await execAsync('git config user.email "test@example.com"', {
		cwd: projectRoot,
	});
	await execAsync('git config user.name "Test User"', { cwd: projectRoot });

	// Create test files
	await writeFile(
		join(projectRoot, 'test.txt'),
		'Hello World\nLine 2\nLine 3\n',
	);
	await writeFile(
		join(projectRoot, 'example.ts'),
		'export function test() {\n  return "test";\n}\n',
	);
	await mkdir(join(projectRoot, 'subdir'), { recursive: true });
	await writeFile(join(projectRoot, 'subdir', 'file.ts'), 'const x = 1;\n');
});

afterAll(async () => {
	await rm(testDir, { recursive: true, force: true });
});

describe('Built-in Tools', () => {
	it('should discover all built-in tools', async () => {
		const tools = await discoverProjectTools(projectRoot);
		const names = tools.map((t) => t.name);

		expect(names).toContain('read');
		expect(names).toContain('write');
		expect(names).toContain('ls');
		expect(names).toContain('tree');
		expect(names).toContain('bash');
		expect(names).toContain('git_status');
		expect(names).toContain('git_diff');
		expect(names).toContain('git_commit');
		expect(names).toContain('ripgrep');
		expect(names).toContain('grep');
		expect(names).toContain('glob');
		expect(names).toContain('apply_patch');
		expect(names).toContain('finish');
		expect(names).toContain('progress_update');
		expect(names).toContain('websearch');
		expect(names).toContain('edit');
		expect(names).toContain('update_plan');
	});

	describe('read tool', () => {
		it('should read entire file', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const readTool = tools.find((t) => t.name === 'read');
			expect(readTool).toBeDefined();

			const result = await readTool?.tool.execute({ path: 'test.txt' });
			expect(result).toHaveProperty('content');
			expect((result as { content: string }).content).toContain('Hello World');
		});

		it('should read file with line range', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const readTool = tools.find((t) => t.name === 'read');

			const result = await readTool?.tool.execute({
				path: 'test.txt',
				startLine: 1,
				endLine: 2,
			});
			expect(result).toHaveProperty('content');
			expect((result as { content: string }).content).toBe(
				'Hello World\nLine 2',
			);
			expect((result as { lineRange: string }).lineRange).toBe('@1-2');
		});
	});

	describe('write tool', () => {
		it('should write content to file', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const writeTool = tools.find((t) => t.name === 'write');

			const result = await writeTool?.tool.execute({
				path: 'new-file.txt',
				content: 'test content',
			});
			expect(result).toHaveProperty('bytes');
			expect((result as { bytes: number }).bytes).toBe(12);
		});
	});

	describe('ls tool', () => {
		it('should list directory contents', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const lsTool = tools.find((t) => t.name === 'ls');

			const result = await lsTool?.tool.execute({ path: '.' });
			expect(result).toHaveProperty('entries');
			expect(Array.isArray((result as { entries: unknown[] }).entries)).toBe(
				true,
			);
		});
	});

	describe('tree tool', () => {
		it('should show directory tree', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const treeTool = tools.find((t) => t.name === 'tree');

			const result = await treeTool?.tool.execute({ path: '.', depth: 2 });
			expect(result).toHaveProperty('tree');
			expect(typeof (result as { tree: string }).tree).toBe('string');
		});
	});

	describe('bash tool', () => {
		it('should execute shell commands', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const bashTool = tools.find((t) => t.name === 'bash');

			const result = await bashTool?.tool.execute({ cmd: 'echo "test"' });
			expect(result).toHaveProperty('stdout');
			expect((result as { stdout: string }).stdout).toContain('test');
		});

		it('should handle command errors', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const bashTool = tools.find((t) => t.name === 'bash');

			await expect(bashTool?.tool.execute({ cmd: 'exit 1' })).rejects.toThrow();
		});
	});

	describe('git tools', () => {
		it('git_status should show repository status', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const gitStatusTool = tools.find((t) => t.name === 'git_status');

			const result = await gitStatusTool?.tool.execute({});
			expect(result).toHaveProperty('staged');
			expect(result).toHaveProperty('unstaged');
		});

		it('git_diff should show diff', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const gitDiffTool = tools.find((t) => t.name === 'git_diff');

			const result = await gitDiffTool?.tool.execute({ all: false });
			expect(result).toHaveProperty('patch');
			expect(typeof (result as { patch: string }).patch).toBe('string');
		});
	});

	describe('ripgrep tool', () => {
		it('should search for patterns', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const ripgrepTool = tools.find((t) => t.name === 'ripgrep');

			const result = await ripgrepTool?.tool.execute({
				query: 'Hello',
				path: '.',
			});
			expect(result).toHaveProperty('matches');
			expect(Array.isArray((result as { matches: unknown[] }).matches)).toBe(
				true,
			);
		});

		it('should handle no matches gracefully', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const ripgrepTool = tools.find((t) => t.name === 'ripgrep');

			const result = await ripgrepTool?.tool.execute({
				query: 'NONEXISTENT_STRING_XYZ',
				path: '.',
			});
			expect((result as { count: number }).count).toBe(0);
		});
	});

	describe('grep tool', () => {
		it('should search in files', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const grepTool = tools.find((t) => t.name === 'grep');

			const result = await grepTool?.tool.execute({
				pattern: 'Hello',
				path: '.',
			});
			expect(result).toHaveProperty('matches');
			expect(result).toHaveProperty('count');
		});

		it('should support file includes', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const grepTool = tools.find((t) => t.name === 'grep');

			const result = await grepTool?.tool.execute({
				pattern: 'export',
				path: '.',
				include: '*.ts',
			});
			expect(result).toHaveProperty('matches');
			expect(result).toHaveProperty('count');
		});
	});

	describe('glob tool', () => {
		it('should find files by pattern', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const globTool = tools.find((t) => t.name === 'glob');

			const result = await globTool?.tool.execute({
				pattern: '*.ts',
				path: 'packages/sdk/src/core/src/tools/builtin',
			});
			expect(result).toHaveProperty('files');
			expect(result).toHaveProperty('count');
			expect(Array.isArray((result as { files: unknown }).files)).toBe(true);
		});

		it('should support glob patterns', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const globTool = tools.find((t) => t.name === 'glob');

			const result = await globTool?.tool.execute({
				pattern: '**/*.txt',
				path: 'packages/sdk/src/core/src/tools/builtin',
				limit: 10,
			});
			expect(result).toHaveProperty('files');
			expect(result).toHaveProperty('count');
		});
	});

	describe('finish tool', () => {
		it('should signal completion', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const finishTool = tools.find((t) => t.name === 'finish');

			const result = await finishTool?.tool.execute({});
			expect(result).toHaveProperty('done');
			expect((result as { done: boolean }).done).toBe(true);
		});
	});

	describe('progress_update tool', () => {
		it('should update progress', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const progressTool = tools.find((t) => t.name === 'progress_update');

			const result = await progressTool?.tool.execute({
				message: 'Working...',
			});
			expect(result).toHaveProperty('message');
			expect((result as { message: string }).message).toBe('Working...');
		});
	});

	describe('update_plan tool', () => {
		it('should update plan items', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const planTool = tools.find((t) => t.name === 'update_plan');

			const result = await planTool?.tool.execute({
				items: [
					{ step: 'Task 1', status: 'done' },
					{ step: 'Task 2', status: 'in-progress' },
				],
			});
			expect(result).toHaveProperty('items');
		});
	});

	describe('apply_patch tool', () => {
		it('should apply enveloped patch', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const patchTool = tools.find((t) => t.name === 'apply_patch');

			const patch = `*** Begin Patch
*** Add File: newfile.txt
+This is new content
*** End Patch`;

			const result = await patchTool?.tool.execute({ patch });
			expect(result).toHaveProperty('ok');
			expect(
				(result as { artifact?: { patch?: string } }).artifact?.patch,
			).toContain('@@ -0,0 +1');
		});

		it('should update existing file using enveloped patch', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const patchTool = tools.find((t) => t.name === 'apply_patch');

			const patch = `*** Begin Patch
*** Update File: test.txt
@@
 Hello World
-Line 2
+Line 2 updated
 Line 3
*** End Patch`;

			const result = await patchTool?.tool.execute({ patch });
			expect(result).toHaveProperty('ok', true);
			const change = (result as { changes?: Array<{ hunks: unknown[] }> })
				.changes?.[0] as
				| {
						filePath: string;
						kind: string;
						hunks: Array<{
							oldStart: number;
							newStart: number;
							oldLines: number;
							newLines: number;
							additions: number;
							deletions: number;
							context?: string;
						}>;
				  }
				| undefined;
			expect(change).toBeDefined();
			expect(change).toMatchObject({ filePath: 'test.txt', kind: 'update' });
			const hunk = change?.hunks?.[0];
			expect(hunk).toMatchObject({
				oldStart: 1,
				newStart: 1,
				oldLines: 3,
				newLines: 3,
				additions: 1,
				deletions: 1,
			});
			expect(
				(result as { artifact?: { patch?: string } }).artifact?.patch,
			).toContain('@@ -1,3 +1,3 @@');

			const updated = await Bun.file(join(projectRoot, 'test.txt')).text();
			expect(updated).toContain('Line 2 updated');
		});

		it('should accept standard unified diff patches', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const patchTool = tools.find((t) => t.name === 'apply_patch');

			const patch = `diff --git a/test.txt b/test.txt
--- a/test.txt
+++ b/test.txt
@@
 Hello World
-Line 2 updated
+Line 2 unified
 Line 3
`;

			const result = await patchTool?.tool.execute({ patch });
			expect(result).toHaveProperty('ok', true);

			const updated = await Bun.file(join(projectRoot, 'test.txt')).text();
			expect(updated).toContain('Line 2 unified');
		});

		it('should allow rejects when requested', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const patchTool = tools.find((t) => t.name === 'apply_patch');

			const patch = `*** Begin Patch
*** Update File: test.txt
@@
 Hello World
-Line 2 unified
+Line 2 final
 Line 3
*** Update File: missing.txt
@@ missing file
-old
+new
*** End Patch`;

			const result = await patchTool?.tool.execute({
				patch,
				allowRejects: true,
			});

			expect(result).toHaveProperty('ok', true);
			const { rejected } = (result ?? {}) as {
				rejected?: Array<{ filePath: string; reason: string }>;
			};
			expect(rejected).toBeDefined();
			expect(rejected?.length).toBe(1);
			expect(rejected?.[0]?.filePath).toBe('missing.txt');
			expect(rejected?.[0]?.reason).toMatch(/File not found/i);

			const updated = await Bun.file(join(projectRoot, 'test.txt')).text();
			expect(updated).toContain('Line 2 final');
		});

		it('should treat already-applied removals as success', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const patchTool = tools.find((t) => t.name === 'apply_patch');

			// Reset file to a state that already omits the removal target.
			await writeFile(
				join(projectRoot, 'test.txt'),
				'Hello World\nLine 3\n',
				'utf-8',
			);
			const patch = `*** Begin Patch
*** Update File: test.txt
-import does.not.exist
-Line 2 final
*** End Patch`;

			const result = await patchTool?.tool.execute({ patch });
			expect(result).toHaveProperty('ok', true);
			const updated = await Bun.file(join(projectRoot, 'test.txt')).text();
			expect(updated).toBe('Hello World\nLine 3\n');
		});
	});

	describe('edit tool', () => {
		it('should edit files', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const editTool = tools.find((t) => t.name === 'edit');

			const testFile = join(projectRoot, 'test.txt');
			const result = await editTool?.tool.execute({
				path: testFile,
				ops: [
					{
						type: 'replace',
						find: 'Hello World',
						replace: 'Hello Universe',
					},
				],
			});
			expect(result).toHaveProperty('opsApplied');
			expect((result as { opsApplied: number }).opsApplied).toBe(1);
		});
	});

	describe('websearch tool', () => {
		it('should have websearch tool', async () => {
			const tools = await discoverProjectTools(projectRoot);
			const websearchTool = tools.find((t) => t.name === 'websearch');

			expect(websearchTool).toBeDefined();
			expect(websearchTool?.name).toBe('websearch');
		});
	});
});
