/**
 * Runtime debug state management
 *
 * Centralizes debug flag state that can be set either via:
 * - Environment variables (AGI_DEBUG, DEBUG_AGI)
 * - Runtime configuration (CLI --debug flag)
 */

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

type DebugState = {
	enabled: boolean;
	traceEnabled: boolean;
	runtimeOverride: boolean | null;
	runtimeTraceOverride: boolean | null;
};

// Global state
const state: DebugState = {
	enabled: false,
	traceEnabled: false,
	runtimeOverride: null,
	runtimeTraceOverride: null,
};

/**
 * Check if environment variables indicate debug mode
 */
function checkEnvDebug(): boolean {
	const sources = [process.env.AGI_DEBUG, process.env.DEBUG_AGI];
	for (const value of sources) {
		if (!value) continue;
		const trimmed = value.trim().toLowerCase();
		if (TRUTHY.has(trimmed) || trimmed === 'all') {
			return true;
		}
	}
	return false;
}

/**
 * Check if environment variables indicate trace mode
 */
function checkEnvTrace(): boolean {
	const sources = [process.env.AGI_TRACE, process.env.TRACE_AGI];
	for (const value of sources) {
		if (!value) continue;
		const trimmed = value.trim().toLowerCase();
		if (TRUTHY.has(trimmed)) {
			return true;
		}
	}
	return false;
}

/**
 * Initialize debug state from environment
 */
function initialize() {
	if (state.runtimeOverride === null) {
		state.enabled = checkEnvDebug();
	}
	if (state.runtimeTraceOverride === null) {
		state.traceEnabled = checkEnvTrace();
	}
}

/**
 * Check if debug mode is enabled
 * Considers both runtime override and environment variables
 */
export function isDebugEnabled(): boolean {
	initialize();
	return state.enabled;
}

/**
 * Check if trace mode is enabled (shows stack traces)
 * Trace mode requires debug mode to be enabled
 */
export function isTraceEnabled(): boolean {
	initialize();
	return state.enabled && state.traceEnabled;
}

/**
 * Enable or disable debug mode at runtime
 * Overrides environment variable settings
 *
 * @param enabled - true to enable debug mode, false to disable
 */
export function setDebugEnabled(enabled: boolean): void {
	state.enabled = enabled;
	state.runtimeOverride = enabled;
}

/**
 * Enable or disable trace mode at runtime
 * Trace mode shows full stack traces in error logs
 *
 * @param enabled - true to enable trace mode, false to disable
 */
export function setTraceEnabled(enabled: boolean): void {
	state.traceEnabled = enabled;
	state.runtimeTraceOverride = enabled;
}

/**
 * Reset debug state to environment defaults
 */
export function resetDebugState(): void {
	state.runtimeOverride = null;
	state.runtimeTraceOverride = null;
	state.enabled = checkEnvDebug();
	state.traceEnabled = checkEnvTrace();
}

/**
 * Get current debug state (for testing/diagnostics)
 */
export function getDebugState(): Readonly<DebugState> {
	initialize();
	return { ...state };
}
