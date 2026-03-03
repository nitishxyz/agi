export type OauthCodexContinuationInput = {
	provider: string;
	isOpenAIOAuth: boolean;
	finishObserved: boolean;
	continuationCount: number;
	maxContinuations: number;
	finishReason?: string;
	rawFinishReason?: string;
	firstToolSeen: boolean;
	droppedPseudoToolText: boolean;
	lastAssistantText: string;
};

export type OauthCodexContinuationDecision = {
	shouldContinue: boolean;
	reason?: string;
};

const INTERMEDIATE_PROGRESS_PATTERNS: RegExp[] = [
	/\bnext\s+i(?:['\u2019]ll|\s+will)\b/i,
	/\bnow\s+i(?:['\u2019]ll|\s+will)\b/i,
	/\bi(?:['\u2019]ll|\s+will)\s+(inspect|check|look|read|scan|trace|review|update|fix|implement|run|continue|retry)\b/i,
	/\bi(?:\s+am|\s*'m)\s+going\s+to\b/i,
	/\b(and|then)\s+continue\b/i,
];

export function looksLikeIntermediateProgressText(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed) return false;
	return INTERMEDIATE_PROGRESS_PATTERNS.some((pattern) =>
		pattern.test(trimmed),
	);
}

function isTruncatedResponse(
	finishReason?: string,
	rawFinishReason?: string,
): boolean {
	if (finishReason === 'length') return true;
	return rawFinishReason === 'max_output_tokens';
}

const MAX_UNCLEAN_EOF_RETRIES = 1;

function isUncleanEof(input: OauthCodexContinuationInput): boolean {
	if (input.finishReason && input.finishReason !== 'unknown') return false;
	if (input.firstToolSeen) return true;
	if (looksLikeIntermediateProgressText(input.lastAssistantText)) return true;
	return false;
}

export function decideOauthCodexContinuation(
	input: OauthCodexContinuationInput,
): OauthCodexContinuationDecision {
	if (input.provider !== 'openai' || !input.isOpenAIOAuth) {
		return { shouldContinue: false };
	}

	if (input.finishObserved) {
		return { shouldContinue: false };
	}

	if (input.continuationCount >= input.maxContinuations) {
		return { shouldContinue: false, reason: 'max-continuations-reached' };
	}

	if (isTruncatedResponse(input.finishReason, input.rawFinishReason)) {
		return { shouldContinue: true, reason: 'truncated' };
	}

	if (
		isUncleanEof(input) &&
		input.continuationCount < MAX_UNCLEAN_EOF_RETRIES
	) {
		return { shouldContinue: true, reason: 'unclean-eof' };
	}

	return { shouldContinue: false };
}
