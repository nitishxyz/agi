import { memo } from 'react';
import { FolderTree } from 'lucide-react';
import { useFileBrowserStore } from '../../stores/fileBrowserStore';

export const FileBrowserSidebarToggle = memo(
	function FileBrowserSidebarToggle() {
		const isExpanded = useFileBrowserStore((s) => s.isExpanded);
		const toggleSidebar = useFileBrowserStore((s) => s.toggleSidebar);

		return (
			<button
				type="button"
				onClick={toggleSidebar}
				className={`relative h-14 w-full transition-colors touch-manipulation flex items-center justify-center border-r-2 ${
					isExpanded
						? 'bg-muted border-primary'
						: 'border-transparent hover:bg-muted/50'
				}`}
				title="Files"
			>
				<FolderTree className="w-5 h-5 text-muted-foreground mx-auto" />
			</button>
		);
	},
);
