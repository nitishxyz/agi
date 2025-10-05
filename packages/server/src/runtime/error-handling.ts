import { APICallError } from 'ai';

export type ErrorPayload = {
	message: string;
	type: string;
	details?: Record<string, unknown>;
};

/**
 * Transforms any error object into a structured error payload
 * suitable for storage and event publishing.
 */
export function toErrorPayload(err: unknown): ErrorPayload {
	const asObj =
		err && typeof err === 'object'
			? (err as Record<string, unknown>)
			: undefined;
	let message = '';
	let errorType = 'unknown';

	// Determine error type
	if (asObj) {
		if ('name' in asObj && typeof asObj.name === 'string') {
			errorType = asObj.name;
		}
		if ('type' in asObj && typeof asObj.type === 'string') {
			errorType = asObj.type;
		}
	}

	// Check if it's an API error
	if (APICallError.isInstance(err)) {
		errorType = 'api_error';
	}

	// Extract message
	if (asObj && typeof asObj.message === 'string' && asObj.message) {
		message = asObj.message as string;
	} else if (typeof err === 'string') {
		message = err as string;
	} else if (asObj && typeof asObj.error === 'string' && asObj.error) {
		message = asObj.error as string;
	} else if (
		asObj &&
		typeof asObj.responseBody === 'string' &&
		asObj.responseBody
	) {
		// Try to parse API error message from responseBody
		try {
			const parsed = JSON.parse(asObj.responseBody as string);
			if (parsed.error && typeof parsed.error.message === 'string') {
				message = parsed.error.message;
			} else {
				message = asObj.responseBody as string;
			}
		} catch {
			message = asObj.responseBody as string;
		}
	} else if (asObj?.statusCode && (asObj as { url?: unknown }).url) {
		message = `HTTP ${String(asObj.statusCode)} error at ${String((asObj as { url?: unknown }).url)}`;
	} else if (asObj?.name) {
		message = String(asObj.name);
	} else {
		// Default: just say "An error occurred" instead of stringifying the whole object
		message = 'An error occurred';
	}

	// Extract details - store the WHOLE error object here instead of in message
	const details: Record<string, unknown> = {};
	if (asObj && typeof asObj === 'object') {
		for (const key of ['name', 'code', 'status', 'statusCode', 'type']) {
			if (asObj[key] != null) details[key] = asObj[key];
		}

		// API call error specific fields
		if ('url' in asObj) details.url = asObj.url;
		if ('isRetryable' in asObj) details.isRetryable = asObj.isRetryable;
		if ('responseBody' in asObj) details.responseBody = asObj.responseBody;
		if ('requestBodyValues' in asObj)
			details.requestBodyValues = asObj.requestBodyValues;
		if ('responseHeaders' in asObj)
			details.responseHeaders = asObj.responseHeaders;
		if ('data' in asObj) details.data = asObj.data;

		if (asObj.cause) {
			const c = asObj.cause as Record<string, unknown> | undefined;
			details.cause = {
				message:
					typeof c?.message === 'string' ? (c.message as string) : undefined,
				code: (c as { code?: unknown })?.code,
				status:
					(c as { status?: unknown; statusCode?: unknown })?.status ??
					(c as { statusCode?: unknown })?.statusCode,
			};
		}
		if (
			(asObj as { response?: { status?: unknown; statusText?: unknown } })
				?.response?.status
		)
			details.response = {
				status: (
					asObj as { response?: { status?: unknown; statusText?: unknown } }
				).response?.status,
				statusText: (
					asObj as { response?: { status?: unknown; statusText?: unknown } }
				).response?.statusText,
			};
	}

	return {
		message,
		type: errorType,
		details: Object.keys(details).length ? details : undefined,
	};
}
