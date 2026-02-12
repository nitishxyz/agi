import { describe, expect, it } from 'bun:test';

import { parsePatchInput } from '../packages/sdk/src/core/src/tools/builtin/patch/parse.ts';

describe('parsePatchInput', () => {
	it('parses unified diffs even when body contains "*** Begin Patch"', () => {
		const patch = [
			'diff --git a/test.txt b/test.txt',
			'--- a/test.txt',
			'+++ b/test.txt',
			'@@ -1 +1,2 @@',
			'-hello',
			'+hello',
			'+*** Begin Patch',
		].join('\n');

		const result = parsePatchInput(patch);

		expect(result.format).toBe('unified');
		expect(result.operations).toHaveLength(1);
		expect(result.operations[0]).toMatchObject({
			kind: 'update',
			filePath: 'test.txt',
		});
	});
});
