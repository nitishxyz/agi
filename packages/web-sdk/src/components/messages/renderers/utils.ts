/**
 * Format a duration in milliseconds to a human-readable string.
 * Shows seconds (with 1 decimal) if >= 1000ms, otherwise shows ms.
 *
 * @example
 * formatDuration(450) // "450ms"
 * formatDuration(1234) // "1.2s"
 * formatDuration(5678) // "5.7s"
 */
export function formatDuration(ms: number | undefined): string {
	if (!ms) return '';
	if (ms >= 1000) {
		return `${(ms / 1000).toFixed(1)}s`;
	}
	return `${ms}ms`;
}

/**
 * Check if a tool result is an error response.
 * Handles both the new ok: false pattern and legacy error patterns.
 */
export function isToolError(result: unknown): boolean {
	if (!result || typeof result !== 'object') return false;
	const obj = result as Record<string, unknown>;
	return obj.ok === false || 'error' in obj || obj.success === false;
}

/**
 * Extract the error message from a tool result.
 * Checks multiple common fields: error, stderr, message, detail, details, reason.
 */
export function getErrorMessage(result: unknown): string | null {
	if (!result || typeof result !== 'object') return null;

	const obj = result as Record<string, unknown>;
	const keys = ['error', 'stderr', 'message', 'detail', 'details', 'reason'];
	for (const key of keys) {
		const value = obj[key];
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (trimmed.length) return trimmed;
		}
	}
	return null;
}

/**
 * Extract error details from a tool result.
 * Returns the details object if present and valid.
 */
export function getErrorDetails(
	result: unknown,
): Record<string, unknown> | null {
	if (!result || typeof result !== 'object') return null;
	const obj = result as Record<string, unknown>;
	if (obj.details && typeof obj.details === 'object') {
		return obj.details as Record<string, unknown>;
	}
	return null;
}
