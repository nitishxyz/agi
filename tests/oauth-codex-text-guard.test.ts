import { describe, expect, test } from 'bun:test';
import { getDb } from '@ottocode/database';
import { messageParts, messages, sessions } from '@ottocode/database/schema';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	consumeOauthCodexTextDelta,
	createOauthCodexTextGuardState,
	stripCodexPseudoToolText,
} from '../packages/server/src/runtime/stream/text-guard.ts';
import { buildHistoryMessages } from '../packages/server/src/runtime/message/history-builder.ts';

describe('oauth codex text guard', () => {
	test('keeps normal assistant text unchanged', () => {
		const input = 'I will inspect the code and run tests next.';
		const result = stripCodexPseudoToolText(input);
		expect(result.sanitized).toBe(input);
		expect(result.dropped).toBe(false);
	});

	test('drops leaked pseudo tool-call suffix', () => {
		const input =
			'Next I will read the files. assistant to=functions.ls commentary {"path":"."}';
		const result = stripCodexPseudoToolText(input);
		expect(result.sanitized).toBe('Next I will read the files.');
		expect(result.dropped).toBe(true);
	});

	test('drops leaked "assistant to" suffix without equals', () => {
		const input = 'Working... assistant to functions.exec_command commentary';
		const result = stripCodexPseudoToolText(input);
		expect(result.sanitized).toBe('Working...');
		expect(result.dropped).toBe(true);
	});

	test('drops leaked trailing assistant token', () => {
		const input = 'Applying fix now. assistant';
		const result = stripCodexPseudoToolText(input);
		expect(result.sanitized).toBe('Applying fix now.');
		expect(result.dropped).toBe(true);
	});

	test('drops leaked call:tool pseudo syntax', () => {
		const input = 'Working now... call:tool{"name":"ls"}';
		const result = stripCodexPseudoToolText(input);
		expect(result.sanitized).toBe('Working now...');
		expect(result.dropped).toBe(true);
	});

	test('handles leakage split across stream chunks', () => {
		const state = createOauthCodexTextGuardState();
		const chunks = [
			'I found the right file. ',
			'assistant to=fun',
			'ctions.ls commentary {"path":"."}',
			' this should never show',
		];

		const emitted = chunks
			.map((chunk) => consumeOauthCodexTextDelta(state, chunk))
			.join('');

		expect(emitted).toBe('I found the right file. ');
		expect(state.dropped).toBe(true);
	});

	test('treats legacy assistant status "completed" as complete', async () => {
		const projectRoot = mkdtempSync(join(tmpdir(), 'otto-oauth-guard-'));
		const db = await getDb(projectRoot);
		const now = Date.now();

		await db.insert(sessions).values({
			id: 'session-status-test',
			agent: 'build',
			provider: 'openai',
			model: 'gpt-5.3-codex',
			projectPath: projectRoot,
			createdAt: now,
			lastActiveAt: now,
		});

		await db.insert(messages).values({
			id: 'user-msg',
			sessionId: 'session-status-test',
			role: 'user',
			status: 'complete',
			agent: 'build',
			provider: 'openai',
			model: 'gpt-5.3-codex',
			createdAt: now,
		});

		await db.insert(messageParts).values({
			id: 'user-part',
			messageId: 'user-msg',
			index: 0,
			type: 'text',
			content: JSON.stringify({ text: 'hello' }),
			agent: 'build',
			provider: 'openai',
			model: 'gpt-5.3-codex',
		});

		await db.insert(messages).values({
			id: 'assistant-msg',
			sessionId: 'session-status-test',
			role: 'assistant',
			status: 'completed',
			agent: 'build',
			provider: 'openai',
			model: 'gpt-5.3-codex',
			createdAt: now + 1,
		});

		await db.insert(messageParts).values({
			id: 'assistant-part',
			messageId: 'assistant-msg',
			index: 0,
			type: 'text',
			content: JSON.stringify({ text: 'world' }),
			agent: 'build',
			provider: 'openai',
			model: 'gpt-5.3-codex',
		});

		const history = await buildHistoryMessages(db, 'session-status-test');
		expect(history.length).toBe(2);
		expect(history[0]?.role).toBe('user');
		expect(history[1]?.role).toBe('assistant');
	});
});
