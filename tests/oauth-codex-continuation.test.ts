import { describe, expect, test } from 'bun:test';
import {
	decideOauthCodexContinuation,
	looksLikeIntermediateProgressText,
} from '../packages/server/src/runtime/agent/oauth-codex-continuation.ts';

describe('oauth codex continuation decision', () => {
	test('detects intermediate progress text', () => {
		expect(
			looksLikeIntermediateProgressText("Next I'll inspect apply.ts."),
		).toBe(true);
		expect(
			looksLikeIntermediateProgressText(
				'Search failed; I’ll retry with a safer query and continue.',
			),
		).toBe(true);
		expect(
			looksLikeIntermediateProgressText('I found and fixed the bug.'),
		).toBe(false);
	});

	test('continues when stream is truncated', () => {
		const decision = decideOauthCodexContinuation({
			provider: 'openai',
			isOpenAIOAuth: true,
			finishObserved: false,
			continuationCount: 0,
			maxContinuations: 6,
			finishReason: 'length',
			rawFinishReason: 'max_output_tokens',
			firstToolSeen: true,
			hasTrailingAssistantText: false,
			droppedPseudoToolText: false,
			lastAssistantText: 'Partial answer...',
		});
		expect(decision.shouldContinue).toBe(true);
		expect(decision.reason).toBe('truncated');
	});

	test('continues when stream ends on tool activity without trailing text', () => {
		const decision = decideOauthCodexContinuation({
			provider: 'openai',
			isOpenAIOAuth: true,
			finishObserved: false,
			continuationCount: 0,
			maxContinuations: 6,
			finishReason: 'stop',
			rawFinishReason: undefined,
			firstToolSeen: true,
			hasTrailingAssistantText: false,
			endedWithToolActivity: true,
			lastToolName: 'read',
			droppedPseudoToolText: false,
			lastAssistantText: 'Working through tool calls',
		});
		expect(decision.shouldContinue).toBe(true);
		expect(decision.reason).toBe('ended-on-tool-activity');
	});

	test('does not continue when the final tool activity is finish', () => {
		const decision = decideOauthCodexContinuation({
			provider: 'openai',
			isOpenAIOAuth: true,
			finishObserved: false,
			continuationCount: 0,
			maxContinuations: 6,
			finishReason: 'stop',
			rawFinishReason: undefined,
			firstToolSeen: true,
			hasTrailingAssistantText: false,
			endedWithToolActivity: true,
			lastToolName: 'finish',
			droppedPseudoToolText: false,
			lastAssistantText: 'Done',
		});
		expect(decision.shouldContinue).toBe(false);
	});

	test('continues when tools ran but no assistant text was produced', () => {
		const decision = decideOauthCodexContinuation({
			provider: 'openai',
			isOpenAIOAuth: true,
			finishObserved: false,
			continuationCount: 0,
			maxContinuations: 6,
			finishReason: 'stop',
			rawFinishReason: undefined,
			firstToolSeen: true,
			hasTrailingAssistantText: false,
			lastToolName: 'search',
			droppedPseudoToolText: false,
			lastAssistantText: '',
		});
		expect(decision.shouldContinue).toBe(true);
		expect(decision.reason).toBe('no-trailing-assistant-text');
	});

	test('does not continue after a clean assistant summary following tool activity', () => {
		const decision = decideOauthCodexContinuation({
			provider: 'openai',
			isOpenAIOAuth: true,
			finishObserved: false,
			continuationCount: 0,
			maxContinuations: 6,
			finishReason: 'stop',
			rawFinishReason: undefined,
			firstToolSeen: true,
			hasTrailingAssistantText: true,
			lastToolName: 'read',
			droppedPseudoToolText: false,
			lastAssistantText:
				'I checked the parser files and removed the leftover block.',
		});
		expect(decision.shouldContinue).toBe(false);
	});

	test('continues for non-finish tool activity even if pseudo tool leakage was dropped', () => {
		const decision = decideOauthCodexContinuation({
			provider: 'openai',
			isOpenAIOAuth: true,
			finishObserved: false,
			continuationCount: 0,
			maxContinuations: 6,
			finishReason: 'stop',
			rawFinishReason: undefined,
			firstToolSeen: true,
			hasTrailingAssistantText: false,
			endedWithToolActivity: true,
			lastToolName: 'apply_patch',
			droppedPseudoToolText: true,
			lastAssistantText: '',
		});
		expect(decision.shouldContinue).toBe(true);
		expect(decision.reason).toBe('ended-on-tool-activity');
	});

	test('does not continue after summary text even without finish tool', () => {
		const decision = decideOauthCodexContinuation({
			provider: 'openai',
			isOpenAIOAuth: true,
			finishObserved: false,
			continuationCount: 0,
			maxContinuations: 6,
			finishReason: 'stop',
			rawFinishReason: undefined,
			firstToolSeen: true,
			hasTrailingAssistantText: true,
			lastToolName: 'search',
			droppedPseudoToolText: false,
			lastAssistantText:
				'I searched the workspace and confirmed the follow-up references are gone.',
		});
		expect(decision.shouldContinue).toBe(false);
	});

	test('does not continue on text alone before any tool activity', () => {
		const decision = decideOauthCodexContinuation({
			provider: 'openai',
			isOpenAIOAuth: true,
			finishObserved: false,
			continuationCount: 0,
			maxContinuations: 6,
			finishReason: 'stop',
			rawFinishReason: undefined,
			firstToolSeen: false,
			hasTrailingAssistantText: true,
			droppedPseudoToolText: false,
			lastAssistantText:
				'Found core files. Next I will inspect parser + apply logic.',
		});
		expect(decision.shouldContinue).toBe(false);
	});

	test('does not continue if finish was observed', () => {
		const decision = decideOauthCodexContinuation({
			provider: 'openai',
			isOpenAIOAuth: true,
			finishObserved: true,
			continuationCount: 0,
			maxContinuations: 6,
			finishReason: 'stop',
			rawFinishReason: undefined,
			firstToolSeen: true,
			hasTrailingAssistantText: true,
			droppedPseudoToolText: false,
			lastAssistantText: 'Done.',
		});
		expect(decision.shouldContinue).toBe(false);
	});

	test('does not continue when stream was aborted by user', () => {
		const decision = decideOauthCodexContinuation({
			provider: 'openai',
			isOpenAIOAuth: true,
			finishObserved: false,
			abortedByUser: true,
			continuationCount: 0,
			maxContinuations: 6,
			finishReason: 'length',
			rawFinishReason: 'max_output_tokens',
			firstToolSeen: true,
			hasTrailingAssistantText: false,
			endedWithToolActivity: true,
			lastToolName: 'write',
			droppedPseudoToolText: false,
			lastAssistantText: 'Partial output',
		});
		expect(decision.shouldContinue).toBe(false);
		expect(decision.reason).toBe('aborted-by-user');
	});

	test('does not continue for non-oauth provider calls', () => {
		const decision = decideOauthCodexContinuation({
			provider: 'anthropic',
			isOpenAIOAuth: false,
			finishObserved: false,
			continuationCount: 0,
			maxContinuations: 6,
			finishReason: 'stop',
			rawFinishReason: undefined,
			firstToolSeen: true,
			hasTrailingAssistantText: false,
			droppedPseudoToolText: false,
			lastAssistantText: "Next I'll inspect files.",
		});
		expect(decision.shouldContinue).toBe(false);
	});

	test('stops continuing after max continuation budget', () => {
		const decision = decideOauthCodexContinuation({
			provider: 'openai',
			isOpenAIOAuth: true,
			finishObserved: false,
			continuationCount: 6,
			maxContinuations: 6,
			finishReason: 'length',
			rawFinishReason: 'max_output_tokens',
			firstToolSeen: true,
			hasTrailingAssistantText: false,
			lastToolName: 'search',
			droppedPseudoToolText: false,
			lastAssistantText: 'Partial output',
		});
		expect(decision.shouldContinue).toBe(false);
		expect(decision.reason).toBe('max-continuations-reached');
	});
});
