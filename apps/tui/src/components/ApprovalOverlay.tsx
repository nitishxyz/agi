import { useKeyboard } from '@opentui/react';
import { colors } from '../theme.ts';
import type { PendingApproval } from '../types.ts';

interface ApprovalOverlayProps {
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

export function ApprovalOverlay({ approval, onApprove, onDeny }: ApprovalOverlayProps) {
	useKeyboard((key) => {
		if (key.name === 'y') onApprove(approval.callId);
		if (key.name === 'n') onDeny(approval.callId);
	});

	const toolLabel = approval.toolName.includes('__')
		? approval.toolName.replace('__', ' › ')
		: approval.toolName;

	return (
		<box
			style={{
				position: 'absolute',
				top: '30%',
				left: 4,
				right: 4,
				border: true,
				borderStyle: 'rounded',
				borderColor: colors.yellow,
				backgroundColor: colors.bg,
				zIndex: 200,
				flexDirection: 'column',
				padding: 1,
				gap: 0,
			}}
			title=" Approve? "
		>
			<box style={{ flexDirection: 'row', gap: 1 }}>
				<text fg={colors.yellow}>⚠</text>
				<text fg={colors.fgBright}>
					<b>{toolLabel}</b>
				</text>
			</box>
			<text fg={colors.fgMuted}>{formatArgs(approval.args)}</text>
			<box style={{ flexDirection: 'row', gap: 3, marginTop: 1 }}>
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
