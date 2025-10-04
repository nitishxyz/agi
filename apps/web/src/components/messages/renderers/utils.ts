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
