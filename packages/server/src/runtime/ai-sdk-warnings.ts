/**
 * AI SDK warning handler.
 *
 * The AI SDK logs provider warnings (e.g. unsupported features like
 * `maxOutputTokens` caps) to the console via `globalThis.AI_SDK_LOG_WARNINGS`.
 * These warnings are noisy during normal operation. We suppress them by
 * default and only surface them when debug mode is enabled.
 *
 * See: https://ai-sdk.dev (AI_SDK_LOG_WARNINGS global)
 */

import { isDebugEnabled } from './debug/state.ts';

type AiSdkWarning =
	| { type: 'unsupported'; feature: string; details?: string }
	| { type: 'compatibility'; feature: string; details?: string }
	| { type: 'other'; message: string };

type LogWarningsOptions = {
	warnings: AiSdkWarning[];
	provider: string;
	model: string;
};

function formatWarning(
	warning: AiSdkWarning,
	provider: string,
	model: string,
): string {
	const prefix = `AI SDK Warning (${provider} / ${model}):`;
	switch (warning.type) {
		case 'unsupported': {
			let message = `${prefix} The feature "${warning.feature}" is not supported.`;
			if (warning.details) message += ` ${warning.details}`;
			return message;
		}
		case 'compatibility': {
			let message = `${prefix} The feature "${warning.feature}" is used in a compatibility mode.`;
			if (warning.details) message += ` ${warning.details}`;
			return message;
		}
		case 'other':
			return `${prefix} ${warning.message}`;
		default:
			return `${prefix} ${JSON.stringify(warning)}`;
	}
}

let installed = false;

/**
 * Install a custom AI SDK warning handler that suppresses warnings unless
 * debug mode is enabled. Safe to call multiple times (installs once).
 */
export function installAiSdkWarningHandler(): void {
	if (installed) return;
	installed = true;

	(
		globalThis as unknown as {
			AI_SDK_LOG_WARNINGS?: ((options: LogWarningsOptions) => void) | false;
		}
	).AI_SDK_LOG_WARNINGS = (options: LogWarningsOptions) => {
		if (!isDebugEnabled()) return;
		if (!options.warnings?.length) return;
		for (const warning of options.warnings) {
			console.warn(formatWarning(warning, options.provider, options.model));
		}
	};
}
