import { useCallback, useState } from 'react';
import { useToolApprovalStore } from '../../stores/toolApprovalStore';
import { Shield, Check, X, Terminal, FileEdit, GitCommit } from 'lucide-react';

const TOOL_ICONS: Record<string, typeof Terminal> = {
	bash: Terminal,
	write: FileEdit,
	apply_patch: FileEdit,
	edit: FileEdit,
	terminal: Terminal,
	git_commit: GitCommit,
	git_push: GitCommit,
};

interface ToolApprovalDialogProps {
	baseUrl: string;
	sessionId: string;
}

export function ToolApprovalDialog({ baseUrl, sessionId }: ToolApprovalDialogProps) {
	const { pendingApprovals, removePendingApproval } = useToolApprovalStore();
	const [processingId, setProcessingId] = useState<string | null>(null);

	const handleApproval = useCallback(
		async (callId: string, approved: boolean) => {
			setProcessingId(callId);
			try {
				const response = await fetch(
					`${baseUrl}/v1/sessions/${sessionId}/approval`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ callId, approved }),
					},
				);
				if (response.ok) {
					removePendingApproval(callId);
				}
			} catch (error) {
				console.error('Failed to send approval:', error);
			} finally {
				setProcessingId(null);
			}
		},
		[baseUrl, sessionId, removePendingApproval],
	);

	if (pendingApprovals.length === 0) return null;

	const formatArgs = (args: unknown): string => {
		if (!args) return '';
		if (typeof args === 'string') return args;
		try {
			const str = JSON.stringify(args, null, 2);
			return str.length > 200 ? `${str.slice(0, 200)}...` : str;
		} catch {
			return String(args);
		}
	};

	return (
		<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
			{pendingApprovals.map((approval) => {
				const Icon = TOOL_ICONS[approval.toolName] || Shield;
				const isProcessing = processingId === approval.callId;

				return (
					<div
						key={approval.callId}
						className="bg-background border border-border rounded-lg shadow-lg p-4 animate-in slide-in-from-right-2"
					>
						<div className="flex items-start gap-3">
							<div className="p-2 bg-warning/10 rounded-lg">
								<Icon className="w-5 h-5 text-warning" />
							</div>
							<div className="flex-1 min-w-0">
								<h3 className="font-semibold text-sm flex items-center gap-2">
									<Shield className="w-4 h-4 text-warning" />
									Tool Approval Required
								</h3>
								<p className="text-sm text-muted-foreground mt-1">
									<code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
										{approval.toolName}
									</code>
								</p>
								{approval.args && (
									<pre className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-x-auto max-h-24 overflow-y-auto">
										{formatArgs(approval.args)}
									</pre>
								)}
							</div>
						</div>
						<div className="flex items-center justify-end gap-2 mt-3">
							<button
								type="button"
								onClick={() => handleApproval(approval.callId, false)}
								disabled={isProcessing}
								className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors hover:bg-muted disabled:opacity-50"
							>
								<X className="w-4 h-4" />
								Reject
							</button>
							<button
								type="button"
								onClick={() => handleApproval(approval.callId, true)}
								disabled={isProcessing}
								className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
							>
								<Check className="w-4 h-4" />
								{isProcessing ? 'Approving...' : 'Approve'}
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
}
