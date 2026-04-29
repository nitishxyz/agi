import { describe, expect, test } from 'bun:test';
import { getToolLocations } from '../packages/acp/src/tools.ts';

describe('ACP tool locations', () => {
	test('uses explicit edit start line', () => {
		const locations = getToolLocations(
			'edit',
			{ path: 'src/file.ts', startLine: 42 },
			'/workspace',
		);

		expect(locations).toEqual([{ path: '/workspace/src/file.ts', line: 42 }]);
	});

	test('uses target line for copy_into', () => {
		const locations = getToolLocations(
			'copy_into',
			{ targetPath: 'src/file.ts', insertAtLine: 12 },
			'/workspace',
		);

		expect(locations).toEqual([{ path: '/workspace/src/file.ts', line: 12 }]);
	});

	test('uses patch hunk line from completed edit result', () => {
		const result = {
			artifact: {
				kind: 'file_diff',
				patch: [
					'--- a/src/file.ts',
					'+++ b/src/file.ts',
					'@@ -20,7 +20,7 @@',
					' const unchanged = true;',
					'-const oldValue = 1;',
					'+const newValue = 2;',
				].join('\n'),
			},
		};

		const locations = getToolLocations(
			'edit',
			{ path: 'src/file.ts' },
			'/workspace',
			result,
		);

		expect(locations).toEqual([{ path: '/workspace/src/file.ts', line: 20 }]);
	});

	test('uses apply_patch change hunk line', () => {
		const patch = [
			'*** Begin Patch',
			'*** Update File: src/file.ts',
			'@@ -4,7 +9,7 @@',
			' const unchanged = true;',
			'-const oldValue = 1;',
			'+const newValue = 2;',
			'*** End Patch',
		].join('\n');
		const result = {
			changes: [
				{
					filePath: 'src/file.ts',
					hunks: [{ oldStart: 4, newStart: 9 }],
				},
			],
		};

		const locations = getToolLocations(
			'apply_patch',
			{ patch },
			'/workspace',
			result,
		);

		expect(locations).toEqual([{ path: '/workspace/src/file.ts', line: 9 }]);
	});

	test('uses standard unified apply_patch hunk line', () => {
		const patch = [
			'--- a/src/file.ts',
			'+++ b/src/file.ts',
			'@@ -4,7 +9,7 @@',
			' const unchanged = true;',
			'-const oldValue = 1;',
			'+const newValue = 2;',
		].join('\n');

		const locations = getToolLocations('apply_patch', { patch }, '/workspace');

		expect(locations).toEqual([{ path: '/workspace/src/file.ts', line: 9 }]);
	});
});
