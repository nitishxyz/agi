export function sanitizeProviderError(
	errorText: string,
	status: number,
): { message: string; status: number; code?: string } {
	const lowerError = errorText.toLowerCase();

	if (
		lowerError.includes('engine_overloaded') ||
		lowerError.includes('overloaded')
	) {
		return {
			message: 'Upstream provider is overloaded. Please try again later.',
			status: 503,
			code: 'provider_overloaded',
		};
	}

	if (status === 429 || lowerError.includes('rate limit')) {
		return {
			message: 'Upstream provider rate limit exceeded. Please try again later.',
			status: 429,
			code: 'provider_rate_limited',
		};
	}

	const isBillingError =
		lowerError.includes('quota') ||
		lowerError.includes('billing') ||
		lowerError.includes('exceeded') ||
		lowerError.includes('insufficient_quota');

	if (isBillingError) {
		return {
			message: 'Upstream provider quota issue. Please try again later.',
			status: 503,
			code: 'provider_quota_exceeded',
		};
	}

	return { message: errorText, status };
}
