import { useKeyboard } from '@opentui/react';
import { colors } from '../theme.ts';
import type { PendingApproval } from '../types.ts';

interface ApproveAllBarProps {
	approvals: PendingApproval[];
	onApprove: (callId: string) => void;
	onApproveAll: () => void;
	onDeny: (callId: string) => void;
}

export function ApproveAllBar({ approvals, onApprove, onApproveAll, onDeny }: ApproveAllBarProps) {
	useKeyboard((key) => {
		if (key.name === 'y') onApprove(approvals[0].callId);
		if (key.name === 'n') onDeny(approvals[0].callId);
		if (key.name === 'a') onApproveAll();
	});

	const count = approvals.length;
	const isSingle = count === 1;

	return (
		<box
			style={{
				width: '100%',
				flexShrink: 0,
				flexDirection: 'row',
				paddingLeft: 1,
				paddingRight: 1,
				height: 1,
				backgroundColor: '#3d2e00',
				gap: 1,
			}}
		>
			<text fg={colors.yellow}>⚠</text>
			<text fg={colors.yellow}>
				{isSingle ? '1 tool' : `${count} tools`} waiting
			</text>
			<text fg={colors.green}>
				<b>[y]</b>{isSingle ? ' approve' : ' next'}
			</text>
			{!isSingle && (
				<text fg={colors.green}>
					<b>[a]</b> approve all
				</text>
			)}
			<text fg={colors.red}>
				<b>[n]</b> deny
			</text>
		</box>
	);
}
