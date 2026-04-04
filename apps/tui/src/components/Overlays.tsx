import { memo, useCallback } from 'react';
import { useOverlayStore } from '../stores/overlay.ts';
import { SessionsOverlay } from './SessionsOverlay.tsx';
import { ModelsOverlay } from './ModelsOverlay.tsx';
import { CommitOverlay } from './CommitOverlay.tsx';
import { HelpOverlay } from './HelpOverlay.tsx';
import { ThemeOverlay } from './ThemeOverlay.tsx';
import { ApprovalsOverlay } from './ApprovalsOverlay.tsx';
import { MCPOverlay } from './MCPOverlay.tsx';
import { UsageOverlay } from './UsageOverlay.tsx';
import type { Session } from '../types.ts';

interface OverlaysProps {
	sessions: Session[];
	hasMore: boolean;
	loadingMore: boolean;
	onLoadMore: () => void;
	onSessionSelect: (session: Session) => void;
	provider: string;
	model: string;
	onModelSelect: (provider: string, model: string) => void;
	onThemeSave: (name: string) => void;
	approvalMode: 'auto' | 'dangerous' | 'all' | 'yolo';
	onApprovalModeSave: (
		mode: 'auto' | 'dangerous' | 'all' | 'yolo',
	) => void | Promise<void>;
}

export const Overlays = memo(function Overlays({
	sessions,
	hasMore,
	loadingMore,
	onLoadMore,
	onSessionSelect,
	provider,
	model,
	onModelSelect,
	onThemeSave,
	approvalMode,
	onApprovalModeSave,
}: OverlaysProps) {
	const overlay = useOverlayStore((s) => s.overlay);
	const setOverlay = useOverlayStore((s) => s.setOverlay);
	const showStatus = useOverlayStore((s) => s.showStatus);

	const handleClose = useCallback(() => setOverlay('none'), [setOverlay]);

	if (overlay === 'none') return null;

	switch (overlay) {
		case 'sessions':
			return (
				<SessionsOverlay
					sessions={sessions}
					hasMore={hasMore}
					loadingMore={loadingMore}
					onLoadMore={onLoadMore}
					onSelect={onSessionSelect}
					onClose={handleClose}
				/>
			);
		case 'commit':
			return (
				<CommitOverlay
					onClose={handleClose}
					onCommitted={() =>
						showStatus({ type: 'success', label: 'committed' }, 3000)
					}
				/>
			);
		case 'models':
			return (
				<ModelsOverlay
					currentProvider={provider}
					currentModel={model}
					onClose={handleClose}
					onSelect={(p, m) => {
						onModelSelect(p, m);
						setOverlay('none');
					}}
				/>
			);
		case 'help':
			return <HelpOverlay onClose={handleClose} />;
		case 'theme':
			return <ThemeOverlay onClose={handleClose} onSave={onThemeSave} />;
		case 'approvals':
			return (
				<ApprovalsOverlay
					currentMode={approvalMode}
					onClose={handleClose}
					onSave={onApprovalModeSave}
				/>
			);
		case 'mcp':
			return <MCPOverlay onClose={handleClose} />;
		case 'usage':
			return <UsageOverlay currentProvider={provider} onClose={handleClose} />;
		default:
			return null;
	}
});
