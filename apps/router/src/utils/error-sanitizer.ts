export function sanitizeProviderError(
	errorText: string,
	status: number,
): { message: string; status: number } {
	const lowerError = errorText.toLowerCase();

	const isBillingError =
		lowerError.includes('quota') ||
		lowerError.includes('billing') ||
		lowerError.includes('rate limit') ||
		lowerError.includes('exceeded') ||
		lowerError.includes('insufficient_quota') ||
		status === 429;

	if (isBillingError) {
		return {
			message: 'Service temporarily unavailable. Please try again later.',
			status: 503,
		};
	}

	return { message: errorText, status };
}
