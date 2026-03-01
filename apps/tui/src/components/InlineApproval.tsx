import { colors } from '../theme.ts';
import type { PendingApproval } from '../types.ts';

interface InlineApprovalProps {
	approval: PendingApproval;
	onApprove: (callId: string) => void;
	onDeny: (callId: string) => void;
}

function formatArgs(args: unknown): string {
	if (!args || typeof args !== 'object') return '';
	const obj = args as Record<string, unknown>;
	if (obj.cmd) return `$ ${String(obj.cmd)}`;
	if (obj.path) return String(obj.path);
	if (obj.filePath) return String(obj.filePath);
	if (obj.patch) return '(patch content)';
	if (obj.query) return `query: ${String(obj.query)}`;
	const str = JSON.stringify(args, null, 2);
	return str.length > 200 ? `${str.slice(0, 197)}…` : str;
}

export function InlineApproval({ approval, onApprove, onDeny }: InlineApprovalProps) {
	const toolLabel = approval.toolName.includes('__')
		? approval.toolName.replace('__', ' › ')
		: approval.toolName;

	return (
		<box
			style={{
				flexDirection: 'column',
				paddingLeft: 2,
				marginTop: 0,
				marginBottom: 0,
				width: '100%',
			}}
		>
			<box style={{ flexDirection: 'row', gap: 1, height: 1 }}>
				<text fg={colors.yellow}>⚠</text>
				<text fg={colors.fgBright}>
					<b>{toolLabel}</b>
				</text>
				<text fg={colors.yellow}>requires approval</text>
			</box>
			<text style={{ paddingLeft: 2 }} fg={colors.fgMuted}>
				{formatArgs(approval.args)}
			</text>
			<box style={{ flexDirection: 'row', gap: 3, paddingLeft: 2, height: 1 }}>
				<text fg={colors.green}>
					<b>[y]</b> approve
				</text>
				<text fg={colors.red}>
					<b>[n]</b> deny
				</text>
			</box>
		</box>
	);
}
