import { memo } from 'react';
import { FilePen } from 'lucide-react';
import { useSessionFilesStore } from '../../stores/sessionFilesStore';
import { useSessionFiles } from '../../hooks/useSessionFiles';

interface SessionFilesSidebarToggleProps {
	sessionId?: string;
}

export const SessionFilesSidebarToggle = memo(
	function SessionFilesSidebarToggle({
		sessionId,
	}: SessionFilesSidebarToggleProps) {
		const isExpanded = useSessionFilesStore((state) => state.isExpanded);
		const toggleSidebar = useSessionFilesStore((state) => state.toggleSidebar);
		const { data } = useSessionFiles(sessionId);

		const fileCount = data?.totalFiles ?? 0;

		return (
			<button
				type="button"
				onClick={toggleSidebar}
			className={`relative h-14 w-full transition-colors touch-manipulation flex items-center justify-center border-r-2 ${
							isExpanded
								? 'bg-muted border-primary'
								: 'border-transparent hover:bg-muted/50'
						}`}
				title="Session Files"
			>
				<FilePen className="w-5 h-5 text-muted-foreground mx-auto" />
				{fileCount > 0 && (
					<span className="absolute top-1 right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-semibold">
						{fileCount > 9 ? '9+' : fileCount}
					</span>
				)}
			</button>
		);
	},
);
