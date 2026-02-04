import { describe, expect, it } from 'bun:test';
import { box } from '@ottocode/cli/src/ui.ts';

describe('box()', () => {
	it('does not throw when columns are tiny', () => {
		const desc = Object.getOwnPropertyDescriptor(process.stdout, 'columns');
		const logs: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			logs.push(args.join(' '));
		};
		try {
			Object.defineProperty(process.stdout, 'columns', {
				value: 1,
				configurable: true,
			});
			expect(() => box('Test', ['content'])).not.toThrow();
		} finally {
			console.log = originalLog;
			if (desc) Object.defineProperty(process.stdout, 'columns', desc);
			else delete (process.stdout as { columns?: number }).columns;
		}
		expect(logs.length).toBeGreaterThan(0);
	});
});
