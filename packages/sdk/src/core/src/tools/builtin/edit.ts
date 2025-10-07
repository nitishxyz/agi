import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import DESCRIPTION from './edit.txt' with { type: 'text' };

const replaceOp = z.object({
	type: z.literal('replace'),
	find: z.string().describe('String or regex (when regex=true)'),
	replace: z.string().default(''),
	regex: z.boolean().optional().default(false),
	flags: z.string().optional().default('g'),
	count: z
		.number()
		.int()
		.min(1)
		.optional()
		.describe('Limit number of replacements'),
});

const insertOp = z.object({
	type: z.literal('insert'),
	position: z.enum(['before', 'after', 'start', 'end']).default('after'),
	pattern: z.string().optional().describe('Anchor pattern for before/after'),
	content: z.string(),
	once: z.boolean().optional().default(true),
});

const deleteRangeOp = z.object({
	type: z.literal('delete_range'),
	start: z.string().describe('Start marker (first occurrence)'),
	end: z.string().describe('End marker (first occurrence after start)'),
	includeBoundaries: z.boolean().optional().default(false),
});

const opSchema = z.discriminatedUnion('type', [
	replaceOp,
	insertOp,
	deleteRangeOp,
]);

export const editTool: Tool = tool({
	description: DESCRIPTION,
	inputSchema: z.object({
		path: z.string().min(1),
		ops: z.array(opSchema).min(1),
		create: z.boolean().optional().default(false),
	}),
	async execute({
		path,
		ops,
		create,
	}: {
		path: string;
		ops: z.infer<typeof opSchema>[];
		create?: boolean;
	}) {
		let exists = false;
		try {
			await access(path, constants.F_OK);
			exists = true;
		} catch {}

		if (!exists) {
			if (!create) throw new Error(`File not found: ${path}`);
			await writeFile(path, '');
		}
		let text = await readFile(path, 'utf-8');
		let applied = 0;

		for (const op of ops) {
			if (op.type === 'replace') {
				const originalText = text;
				if (op.regex) {
					const re = new RegExp(op.find, op.flags || 'g');
					if (op.count && op.count > 0) {
						let n = 0;
						text = text.replace(re, (m) => {
							if (n < (op.count as number)) {
								n += 1;
								return op.replace;
							}
							return m;
						});
					} else text = text.replace(re, op.replace);
				} else {
					// Check if the text to find exists
					if (!text.includes(op.find)) {
						console.warn(
							`Warning: Text not found for replace operation: "${op.find.substring(0, 50)}${op.find.length > 50 ? '...' : ''}"`,
						);
					}
					if (op.count && op.count > 0) {
						let remaining = op.count as number;
						let idx = text.indexOf(op.find);
						while (idx !== -1 && remaining > 0) {
							text =
								text.slice(0, idx) +
								op.replace +
								text.slice(idx + op.find.length);
							remaining -= 1;
							idx = text.indexOf(op.find, idx + op.replace.length);
						}
					} else {
						text = text.split(op.find).join(op.replace);
					}
				}
				// Only count as applied if text actually changed
				if (text !== originalText) {
					applied += 1;
				}
			} else if (op.type === 'insert') {
				if (op.position === 'start') {
					text = `${op.content}${text}`;
					applied += 1;
					continue;
				}
				if (op.position === 'end') {
					text = `${text}${op.content}`;
					applied += 1;
					continue;
				}
				if (!op.pattern)
					throw new Error('insert requires pattern for before/after');
				const idx = text.indexOf(op.pattern);
				if (idx === -1) continue;
				if (op.position === 'before')
					text = text.slice(0, idx) + op.content + text.slice(idx);
				else
					text =
						text.slice(0, idx + op.pattern.length) +
						op.content +
						text.slice(idx + op.pattern.length);
				applied += 1;
				if (op.once) continue;
			} else if (op.type === 'delete_range') {
				const startIdx = text.indexOf(op.start);
				if (startIdx === -1) continue;
				const after = startIdx + op.start.length;
				const endIdx = text.indexOf(op.end, after);
				if (endIdx === -1) continue;
				const from = op.includeBoundaries ? startIdx : after;
				const to = op.includeBoundaries ? endIdx + op.end.length : endIdx;
				text = text.slice(0, from) + text.slice(to);
				applied += 1;
			}
		}

		await writeFile(path, text);
		return { path, opsApplied: applied, bytes: text.length };
	},
});
