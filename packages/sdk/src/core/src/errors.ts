/**
 * Base error class for all otto errors
 */
export class OttoError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly status: number = 500,
		public readonly details?: Record<string, unknown>,
	) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}

	toJSON() {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			status: this.status,
			details: this.details,
		};
	}
}

/**
 * Authentication and authorization errors
 */
export class AuthError extends OttoError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 'AUTH_ERROR', 401, details);
	}
}

/**
 * Configuration errors
 */
export class ConfigError extends OttoError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 'CONFIG_ERROR', 500, details);
	}
}

/**
 * Tool execution errors
 */
export class ToolError extends OttoError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 'TOOL_ERROR', 500, details);
	}
}

/**
 * Provider errors (API, model not found, etc.)
 */
export class ProviderError extends OttoError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 'PROVIDER_ERROR', 500, details);
	}
}

/**
 * Database errors
 */
export class DatabaseError extends OttoError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 'DATABASE_ERROR', 500, details);
	}
}

/**
 * Validation errors (bad input, schema mismatch, etc.)
 */
export class ValidationError extends OttoError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 'VALIDATION_ERROR', 400, details);
	}
}

/**
 * Not found errors (session, agent, tool, etc.)
 */
export class NotFoundError extends OttoError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 'NOT_FOUND', 404, details);
	}
}

/**
 * Service errors from ask-service, session-manager, etc.
 */
export class ServiceError extends OttoError {
	constructor(
		message: string,
		code = 'SERVICE_ERROR',
		status = 500,
		details?: Record<string, unknown>,
	) {
		super(message, code, status, details);
	}
}
