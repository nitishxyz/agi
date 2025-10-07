import { AlertCircle } from 'lucide-react';

interface ToolErrorDisplayProps {
	error: string;
	stack?: string;
	showStack?: boolean;
}

/**
 * Shared error display component for tool results with ok: false
 * Matches the structure and colors of ErrorRenderer
 */
export function ToolErrorDisplay({ error, stack, showStack = false }: ToolErrorDisplayProps) {
	return (
		<div className="mt-2 ml-5 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded text-sm">
			<div className="flex items-start gap-2">
				<AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
				<div className="flex-1 space-y-2">
					<div>
						<div className="font-medium text-red-600 dark:text-red-400">
							Tool Error:
						</div>
						<div className="mt-1 text-red-900 dark:text-red-200 whitespace-pre-wrap">
							{error}
						</div>
					</div>
					{showStack && stack && (
						<details className="mt-2">
							<summary className="cursor-pointer text-xs text-red-700 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200">
								View stack trace
							</summary>
							<pre className="mt-2 p-2 bg-red-100/50 dark:bg-red-900/20 rounded text-xs overflow-x-auto text-red-800 dark:text-red-300">
								{stack}
							</pre>
						</details>
					)}
				</div>
			</div>
		</div>
	);
}
