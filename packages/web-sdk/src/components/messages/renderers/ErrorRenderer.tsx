import type React from 'react';
import { useState } from 'react';
import { openUrl } from '../../../lib/open-url';
import {
	ChevronDown,
	ChevronRight,
	RefreshCw,
	CreditCard,
	Scissors,
} from 'lucide-react';
import type { ContentJson } from './types';

interface ErrorRendererProps {
	contentJson: ContentJson;
	debug?: boolean;
	sessionId?: string;
	onRetry?: () => void;
	onCompact?: () => void;
}

export function ErrorRenderer({
	contentJson,
	debug: _debug,
	sessionId: _sessionId,
	onRetry,
	onCompact,
}: ErrorRendererProps) {
	const [showRawDetails, setShowRawDetails] = useState(false);

	// Check for special error types
	const isBalanceLow =
		contentJson.type === 'balance_low' ||
		contentJson.errorType === 'balance_low';
	const isContextExceeded =
		contentJson.type === 'context_length_exceeded' ||
		contentJson.errorType === 'context_length_exceeded';
	const _isRetryable = contentJson.isRetryable === true || isBalanceLow;

	// Handle different error structures:
	// 1. { error: { name, url, statusCode, ... } } - from API errors
	// 2. { message, type, details: { ... }, isAborted } - from toErrorPayload
	// 3. { message, ... } - simple errors

	let errorDetails: Record<string, unknown> | undefined;
	let errorMessage: string | undefined;
	let errorType: string | undefined;
	let isAborted = false;

	// Check if we have the nested 'error' structure
	if (contentJson.error && typeof contentJson.error === 'object') {
		errorDetails = contentJson.error as Record<string, unknown>;
		// Try to extract message from nested error
		if (errorDetails.message && typeof errorDetails.message === 'string') {
			errorMessage = errorDetails.message;
		}
		if (errorDetails.type && typeof errorDetails.type === 'string') {
			errorType = errorDetails.type;
		}
	}
	// Check if we have the toErrorPayload structure
	else if (contentJson.details && typeof contentJson.details === 'object') {
		errorDetails = contentJson.details as Record<string, unknown>;
		if (contentJson.message && typeof contentJson.message === 'string') {
			errorMessage = contentJson.message;
		}
		if (contentJson.type && typeof contentJson.type === 'string') {
			errorType = contentJson.type;
		}
		if (contentJson.isAborted === true) {
			isAborted = true;
		}
	}
	// Simple error structure
	else {
		if (contentJson.message && typeof contentJson.message === 'string') {
			errorMessage = contentJson.message;
		}
		if (contentJson.type && typeof contentJson.type === 'string') {
			errorType = contentJson.type;
		}
		if (contentJson.isAborted === true) {
			isAborted = true;
		}
		// Use the whole contentJson as details if we don't have a specific details field
		errorDetails = contentJson as Record<string, unknown>;
	}

	// Try to extract and parse API error from responseBody if available
	let apiError: { type?: string; message?: string; code?: string } | undefined;
	if (
		errorDetails?.responseBody &&
		typeof errorDetails.responseBody === 'string'
	) {
		try {
			const parsed = JSON.parse(errorDetails.responseBody);
			if (parsed.error && typeof parsed.error === 'object') {
				apiError = {
					type:
						typeof parsed.error.type === 'string'
							? parsed.error.type
							: undefined,
					message:
						typeof parsed.error.message === 'string'
							? parsed.error.message
							: undefined,
					code:
						typeof parsed.error.code === 'string'
							? parsed.error.code
							: undefined,
				};
			}
		} catch {
			// Ignore parse errors
		}
	}

	const isCopilotModelError =
		(apiError?.code === 'model_not_supported' ||
			apiError?.message?.toLowerCase().includes('model is not supported')) &&
		(String(errorDetails?.url ?? '').includes('githubcopilot.com') ||
			contentJson.type === 'api_error');

	const isCopilotResponsesOnly =
		apiError?.message
			?.toLowerCase()
			.includes('not accessible via the /chat/completions') &&
		String(errorDetails?.url ?? '').includes('githubcopilot.com');

	if (isCopilotResponsesOnly) {
		const model = (errorDetails?.requestBodyValues as Record<string, unknown>)
			?.model;
		return (
			<div className="space-y-3">
				<div className="space-y-1">
					<div className="font-medium text-amber-600 dark:text-amber-400">
						Model requires Responses API
					</div>
					<p className="text-sm text-foreground">
						{model ? (
							<>
								<code className="px-1 py-0.5 bg-muted rounded text-xs">
									{String(model)}
								</code>{' '}
								is only available via the Responses API, which is not yet
								supported.
							</>
						) : (
							<>
								This model is only available via the Responses API, which is not
								yet supported.
							</>
						)}
					</p>
					<p className="text-xs text-muted-foreground">
						Codex models (gpt-5.1-codex, gpt-5.2-codex, etc.) require the
						Responses API. Try a chat-compatible model like gpt-5,
						claude-sonnet-4, or gpt-4.1.
					</p>
				</div>
				{onRetry && (
					<div className="pt-1">
						<button
							type="button"
							onClick={onRetry}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
						>
							<RefreshCw className="w-3 h-3" />
							Retry
						</button>
					</div>
				)}
			</div>
		);
	}

	if (isCopilotModelError) {
		const model = (errorDetails?.requestBodyValues as Record<string, unknown>)
			?.model;
		return (
			<div className="space-y-3">
				<div className="space-y-1">
					<div className="font-medium text-amber-600 dark:text-amber-400">
						Model not available
					</div>
					<p className="text-sm text-foreground">
						{model ? (
							<>
								<code className="px-1 py-0.5 bg-muted rounded text-xs">
									{String(model)}
								</code>{' '}
								is not available. You need a Copilot Pro (or higher) plan and
								the model must be enabled in your settings.
							</>
						) : (
							<>
								The requested model is not available. You need a Copilot Pro (or
								higher) plan and the model must be enabled in your settings.
							</>
						)}
					</p>
					<p className="text-xs text-muted-foreground">
						Enable models at{' '}
						<a
							href="https://github.com/settings/copilot"
							target="_blank"
							rel="noopener noreferrer"
							className="underline hover:text-foreground transition-colors"
							onClick={(e) => {
								e.preventDefault();
								openUrl('https://github.com/settings/copilot');
							}}
						>
							github.com/settings/copilot
						</a>
					</p>
				</div>
				{onRetry && (
					<div className="pt-1">
						<button
							type="button"
							onClick={onRetry}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
						>
							<RefreshCw className="w-3 h-3" />
							Retry
						</button>
					</div>
				)}
			</div>
		);
	}

	// Special UI for balance_low errors
	if (isBalanceLow) {
		return (
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<CreditCard className="h-4 w-4 text-amber-500" />
					<span className="font-medium text-foreground">Balance too low</span>
				</div>
				<p className="text-sm text-muted-foreground">
					Complete your top-up in the modal, then retry your request.
				</p>
				{onRetry && (
					<div className="pt-1">
						<button
							type="button"
							onClick={onRetry}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
						>
							<RefreshCw className="w-3 h-3" />
							Retry
						</button>
					</div>
				)}
			</div>
		);
	}

	if (isContextExceeded) {
		return (
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<Scissors className="h-4 w-4 text-amber-500" />
					<span className="font-medium text-foreground">
						Context window exceeded
					</span>
				</div>
				<p className="text-sm text-muted-foreground">
					The conversation is too long for the model. Compact to reduce context
					size, then retry.
				</p>
				<div className="flex items-center gap-2 pt-1">
					{onCompact && (
						<button
							type="button"
							onClick={onCompact}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
						>
							<Scissors className="w-3 h-3" />
							Compact
						</button>
					)}
					{onRetry && (
						<button
							type="button"
							onClick={onRetry}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-border text-foreground hover:bg-muted transition-colors"
						>
							<RefreshCw className="w-3 h-3" />
							Retry
						</button>
					)}
				</div>
			</div>
		);
	}

	// Default error UI
	const renderValue = (value: unknown): React.JSX.Element => {
		if (value === null || value === undefined) {
			return <span className="text-muted-foreground">null</span>;
		}
		if (typeof value === 'boolean') {
			return (
				<span className="text-amber-600 dark:text-amber-400">
					{String(value)}
				</span>
			);
		}
		if (typeof value === 'number') {
			return <span className="text-blue-600 dark:text-blue-400">{value}</span>;
		}
		if (typeof value === 'string') {
			// If it looks like JSON, try to format it
			if (value.startsWith('{') || value.startsWith('[')) {
				try {
					const parsed = JSON.parse(value);
					return (
						<pre className="mt-1 p-2 bg-muted/50 rounded text-xs overflow-x-auto">
							<code>{JSON.stringify(parsed, null, 2)}</code>
						</pre>
					);
				} catch {
					// Not valid JSON, render as string
				}
			}
			return <span className="text-foreground">{value}</span>;
		}
		if (typeof value === 'object') {
			return (
				<pre className="mt-1 p-2 bg-muted/50 rounded text-xs overflow-x-auto">
					<code>{JSON.stringify(value, null, 2)}</code>
				</pre>
			);
		}
		return <span className="text-foreground">{String(value)}</span>;
	};

	const importantFields = [
		'name',
		'statusCode',
		'url',
		'model',
		'isRetryable',
		'cause',
	];
	const renderedFields = new Set<string>();

	return (
		<div className="space-y-2 text-sm">
			{isAborted && (
				<div className="text-amber-600 dark:text-amber-400 font-medium">
					Request aborted
				</div>
			)}

			{/* Show API error message first if available */}
			{apiError?.message && (
				<div className="space-y-1">
					<div className="font-medium text-red-600 dark:text-red-400">
						API Error:
					</div>
					<div className="text-foreground">{apiError.message}</div>
					{apiError.type && (
						<div className="text-xs text-muted-foreground">
							Type: {apiError.type}
						</div>
					)}
				</div>
			)}

			{/* Show regular error message if no API error */}
			{!apiError?.message && errorMessage && (
				<div className="space-y-1">
					<div className="font-medium text-red-600 dark:text-red-400">
						Error:
					</div>
					<div className="text-foreground">{errorMessage}</div>
					{errorType && (
						<div className="text-xs text-muted-foreground">
							Type: {errorType}
						</div>
					)}
				</div>
			)}

			{/* Retry button */}
			{onRetry && (
				<div className="pt-2">
					<button
						type="button"
						onClick={onRetry}
						className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
					>
						<RefreshCw className="w-3 h-3" />
						Retry
					</button>
				</div>
			)}

			{/* Show important details from errorDetails */}
			{errorDetails && (
				<div className="space-y-1.5">
					{importantFields.map((field) => {
						const value = errorDetails[field];
						if (value === undefined || value === null) return null;
						renderedFields.add(field);
						return (
							<div key={field} className="flex gap-2">
								<span className="font-medium text-muted-foreground min-w-[100px]">
									{field}:
								</span>
								{renderValue(value)}
							</div>
						);
					})}
				</div>
			)}

			{/* Collapsible raw details */}
			{errorDetails && (
				<div className="mt-3 border-t border-border pt-2">
					<button
						type="button"
						onClick={() => setShowRawDetails(!showRawDetails)}
						className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						{showRawDetails ? (
							<ChevronDown className="h-3 w-3" />
						) : (
							<ChevronRight className="h-3 w-3" />
						)}
						{showRawDetails ? 'Hide' : 'View'} Raw Error Details
					</button>
					{showRawDetails && (
						<div className="mt-2">
							<pre className="p-3 bg-muted/50 rounded text-xs overflow-x-auto max-h-96 overflow-y-auto">
								<code>{JSON.stringify(errorDetails, null, 2)}</code>
							</pre>
						</div>
					)}
				</div>
			)}

			{_debug && (
				<details className="mt-4 text-xs">
					<summary className="cursor-pointer text-muted-foreground">
						Debug Info
					</summary>
					<pre className="mt-2 p-2 bg-muted/30 rounded overflow-x-auto">
						<code>
							{JSON.stringify({ contentJson, errorDetails, apiError }, null, 2)}
						</code>
					</pre>
				</details>
			)}
		</div>
	);
}
