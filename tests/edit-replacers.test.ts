import { describe, test, expect } from 'bun:test';
import {
	replace,
	SimpleReplacer,
	LineTrimmedReplacer,
	BlockAnchorReplacer,
	WhitespaceNormalizedReplacer,
	IndentationFlexibleReplacer,
	TrimmedBoundaryReplacer,
	ContextAwareReplacer,
	MultiOccurrenceReplacer,
} from '../packages/sdk/src/core/src/tools/builtin/edit/replacers.ts';

describe('edit replacers', () => {
	describe('SimpleReplacer', () => {
		test('yields the find string as-is', () => {
			const results = [...SimpleReplacer('hello world', 'hello')];
			expect(results).toEqual(['hello']);
		});
	});

	describe('LineTrimmedReplacer', () => {
		test('matches lines with different indentation', () => {
			const content = '  const x = 1;\n  const y = 2;';
			const find = 'const x = 1;';
			const results = [...LineTrimmedReplacer(content, find)];
			expect(results.length).toBe(1);
			expect(results[0]).toBe('  const x = 1;');
		});

		test('matches multi-line with trimmed comparison', () => {
			const content = '\tfunction foo() {\n\t\treturn 1;\n\t}';
			const find = 'function foo() {\n  return 1;\n}';
			const results = [...LineTrimmedReplacer(content, find)];
			expect(results.length).toBe(1);
		});
	});

	describe('BlockAnchorReplacer', () => {
		test('matches block by first and last line anchors', () => {
			const content =
				'function foo() {\n  const x = 1;\n  return x;\n}';
			const find =
				'function foo() {\n  const y = 999;\n  return y;\n}';
			const results = [...BlockAnchorReplacer(content, find)];
			expect(results.length).toBe(1);
			expect(results[0]).toContain('function foo()');
			expect(results[0]).toContain('}');
		});

		test('skips blocks with fewer than 3 lines', () => {
			const content = 'a\nb';
			const find = 'a\nb';
			const results = [...BlockAnchorReplacer(content, find)];
			expect(results.length).toBe(0);
		});
	});

	describe('WhitespaceNormalizedReplacer', () => {
		test('matches with different internal whitespace', () => {
			const content = 'const   x   =   1;';
			const find = 'const x = 1;';
			const results = [
				...WhitespaceNormalizedReplacer(content, find),
			];
			expect(results.length).toBeGreaterThan(0);
		});
	});

	describe('IndentationFlexibleReplacer', () => {
		test('matches blocks with different indentation levels', () => {
			const content = '    if (true) {\n        return 1;\n    }';
			const find = 'if (true) {\n    return 1;\n}';
			const results = [
				...IndentationFlexibleReplacer(content, find),
			];
			expect(results.length).toBe(1);
			expect(results[0]).toBe(
				'    if (true) {\n        return 1;\n    }',
			);
		});
	});

	describe('TrimmedBoundaryReplacer', () => {
		test('matches when find has leading/trailing whitespace', () => {
			const content = 'hello world';
			const find = '  hello world  ';
			const results = [...TrimmedBoundaryReplacer(content, find)];
			expect(results.length).toBeGreaterThan(0);
		});

		test('skips when find is already trimmed', () => {
			const content = 'hello world';
			const find = 'hello world';
			const results = [...TrimmedBoundaryReplacer(content, find)];
			expect(results.length).toBe(0);
		});
	});

	describe('ContextAwareReplacer', () => {
		test('matches block with 50%+ middle line similarity', () => {
			const content =
				'function test() {\n  const a = 1;\n  const b = 2;\n  return a + b;\n}';
			const find =
				'function test() {\n  const a = 1;\n  const b = 2;\n  return a + b;\n}';
			const results = [...ContextAwareReplacer(content, find)];
			expect(results.length).toBe(1);
		});
	});

	describe('MultiOccurrenceReplacer', () => {
		test('yields for each occurrence', () => {
			const content = 'foo bar foo baz foo';
			const find = 'foo';
			const results = [...MultiOccurrenceReplacer(content, find)];
			expect(results.length).toBe(3);
		});
	});

	describe('replace function', () => {
		test('exact replacement', () => {
			const result = replace('hello world', 'hello', 'hi');
			expect(result).toBe('hi world');
		});

		test('replaceAll', () => {
			const result = replace('foo bar foo', 'foo', 'baz', true);
			expect(result).toBe('baz bar baz');
		});

		test('throws when oldString equals newString', () => {
			expect(() => replace('hello', 'hello', 'hello')).toThrow(
				'oldString and newString must be different',
			);
		});

		test('throws when not found', () => {
			expect(() => replace('hello', 'xyz', 'abc')).toThrow(
				'oldString not found in content',
			);
		});

		test('fuzzy match with trimmed lines', () => {
			const content = '\tconst port = 3000;\n\tconst host = "localhost";';
			const result = replace(
				content,
				'const port = 3000;',
				'const port = 8080;',
			);
			expect(result).toContain('8080');
		});

		test('fuzzy match with different indentation', () => {
			const content =
				'    function init() {\n        console.log("hello");\n    }';
			const result = replace(
				content,
				'function init() {\n    console.log("hello");\n}',
				'function init() {\n    console.log("world");\n}',
			);
			expect(result).toContain('world');
		});

		test('throws on multiple exact matches without replaceAll', () => {
			expect(() =>
				replace('foo foo', 'foo', 'bar'),
			).toThrow('multiple matches');
		});

		test('handles trailing comma mismatch via fuzzy', () => {
			const content =
				'const config = {\n  name: "test",\n  port: 3000,\n  debug:  false\n};';
			const result = replace(
				content,
				'  port: 3000,\n  debug: false',
				'  port: 8080,\n  debug: true',
			);
			expect(result).toContain('8080');
		});
	});
});
