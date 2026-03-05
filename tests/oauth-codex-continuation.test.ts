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
			droppedPseudoToolText: false,
			lastAssistantText: 'Working through tool calls',
		});
		expect(decision.shouldContinue).toBe(true);
		expect(decision.reason).toBe('ended-on-tool-activity');
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
			droppedPseudoToolText: false,
			lastAssistantText: '',
		});
		expect(decision.shouldContinue).toBe(true);
		expect(decision.reason).toBe('no-trailing-assistant-text');
	});

	test('continues when only mid-tool text exists but no trailing text after tools', () => {
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
			droppedPseudoToolText: false,
			lastAssistantText: "Next I'll inspect parser files.",
		});
		expect(decision.shouldContinue).toBe(true);
		expect(decision.reason).toBe('no-trailing-assistant-text');
	});

	test('does not continue for pseudo tool leakage alone', () => {
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
			droppedPseudoToolText: true,
			lastAssistantText: "Next I'll inspect the parser.",
		});
		expect(decision.shouldContinue).toBe(false);
	});

	test('does not continue on intermediate progress text alone', () => {
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
			droppedPseudoToolText: false,
			lastAssistantText: 'Partial output',
		});
		expect(decision.shouldContinue).toBe(false);
		expect(decision.reason).toBe('max-continuations-reached');
	});
});
