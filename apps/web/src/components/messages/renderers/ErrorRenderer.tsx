import { AlertCircle, XOctagon } from 'lucide-react';

interface ErrorContent {
	message: string;
	type?: string;
	details?: Record<string, unknown>;
	isAborted?: boolean;
}

interface ErrorRendererProps {
	contentJson: ErrorContent;
	toolDurationMs?: number;
}

export function ErrorRenderer({ contentJson }: ErrorRendererProps) {
	const { message, type, details, isAborted } = contentJson;

	return (
		<div
			className={`rounded-lg border p-4 ${
				isAborted
					? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
					: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
			}`}
		>
			<div className="flex items-start gap-3">
				{isAborted ? (
					<XOctagon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
				) : (
					<AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
				)}
				<div className="flex-1 space-y-2">
					<div
						className={`font-medium ${
							isAborted
								? 'text-amber-900 dark:text-amber-100'
								: 'text-red-900 dark:text-red-100'
						}`}
					>
						{isAborted ? 'Generation Stopped' : 'Error'}
					</div>
					<div
						className={`text-sm ${
							isAborted
								? 'text-amber-800 dark:text-amber-200'
								: 'text-red-800 dark:text-red-200'
						}`}
					>
						{message}
					</div>

					{type && (
						<div className="text-xs opacity-75">
							Type: <span className="font-mono">{type}</span>
						</div>
					)}

					{details && Object.keys(details).length > 0 && (
						<details className="text-xs mt-2">
							<summary
								className={`cursor-pointer hover:underline ${
									isAborted
										? 'text-amber-700 dark:text-amber-300'
										: 'text-red-700 dark:text-red-300'
								}`}
							>
								View Details
							</summary>
							<pre className="mt-2 p-2 bg-black/5 dark:bg-white/5 rounded overflow-x-auto text-xs">
								{JSON.stringify(details, null, 2)}
							</pre>
						</details>
					)}
				</div>
			</div>
		</div>
	);
}
