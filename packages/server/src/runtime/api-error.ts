/**
 * Unified API error handling
 *
 * Provides consistent error serialization and response formatting
 * across all API endpoints.
 */

import { isDebugEnabled } from './debug-state';
import { toErrorPayload } from './error-handling';

/**
 * Standard API error response format
 */
export type APIErrorResponse = {
	error: {
		message: string;
		type: string;
		code?: string;
		status?: number;
		details?: Record<string, unknown>;
		stack?: string;
	};
};

/**
 * Custom API Error class
 */
export class APIError extends Error {
	public readonly code?: string;
	public readonly status: number;
	public readonly type: string;
	public readonly details?: Record<string, unknown>;

	constructor(
		message: string,
		options?: {
			code?: string;
			status?: number;
			type?: string;
			details?: Record<string, unknown>;
			cause?: unknown;
		},
	) {
		super(message);
		this.name = 'APIError';
		this.code = options?.code;
		this.status = options?.status ?? 500;
		this.type = options?.type ?? 'api_error';
		this.details = options?.details;

		if (options?.cause) {
			this.cause = options.cause;
		}

		// Maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, APIError);
		}
	}
}

/**
 * Serialize any error into a consistent API error response
 *
 * @param err - The error to serialize
 * @returns A properly formatted API error response
 */
export function serializeError(err: unknown): APIErrorResponse {
	// Use existing error payload logic
	const payload = toErrorPayload(err);

	// Determine HTTP status code
	let status = 500;
	if (err && typeof err === 'object') {
		const errObj = err as Record<string, unknown>;
		if (typeof errObj.status === 'number') {
			status = errObj.status;
		} else if (typeof errObj.statusCode === 'number') {
			status = errObj.statusCode;
		} else if (
			errObj.details &&
			typeof errObj.details === 'object' &&
			typeof (errObj.details as Record<string, unknown>).statusCode === 'number'
		) {
			status = (errObj.details as Record<string, unknown>).statusCode as number;
		}
	}

	// Handle APIError instances
	if (err instanceof APIError) {
		status = err.status;
	}

	// Extract code if available
	let code: string | undefined;
	if (err && typeof err === 'object') {
		const errObj = err as Record<string, unknown>;
		if (typeof errObj.code === 'string') {
			code = errObj.code;
		}
	}

	if (err instanceof APIError && err.code) {
		code = err.code;
	}

	// Build response
	const response: APIErrorResponse = {
		error: {
			message: payload.message || 'An error occurred',
			type: payload.type || 'unknown',
			status,
			...(code ? { code } : {}),
			...(payload.details ? { details: payload.details } : {}),
		},
	};

	// Include stack trace in debug mode
	if (isDebugEnabled() && err instanceof Error && err.stack) {
		response.error.stack = err.stack;
	}

	return response;
}

/**
 * Create an error response with proper HTTP status code
 *
 * @param err - The error to convert
 * @returns Tuple of [APIErrorResponse, HTTP status code]
 */
export function createErrorResponse(err: unknown): [APIErrorResponse, number] {
	const response = serializeError(err);
	return [response, response.error.status ?? 500];
}

/**
 * Normalize error to ensure it's an Error instance
 *
 * @param err - The error to normalize
 * @returns An Error instance
 */
export function normalizeError(err: unknown): Error {
	if (err instanceof Error) {
		return err;
	}

	if (typeof err === 'string') {
		return new Error(err);
	}

	if (err && typeof err === 'object') {
		const errObj = err as Record<string, unknown>;
		if (typeof errObj.message === 'string') {
			return new Error(errObj.message);
		}
	}

	return new Error('An unknown error occurred');
}

/**
 * Extract error message from any error type
 *
 * @param err - The error to extract message from
 * @returns The error message string
 */
export function getErrorMessage(err: unknown): string {
	if (typeof err === 'string') {
		return err;
	}

	if (err instanceof Error) {
		return err.message;
	}

	if (err && typeof err === 'object') {
		const errObj = err as Record<string, unknown>;
		if (typeof errObj.message === 'string') {
			return errObj.message;
		}
		if (typeof errObj.error === 'string') {
			return errObj.error;
		}
	}

	return 'An unknown error occurred';
}

// Legacy compatibility - AskServiceError alias
export { APIError as AskServiceError };
