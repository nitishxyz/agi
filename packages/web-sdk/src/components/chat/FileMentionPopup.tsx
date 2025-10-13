import { useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import {
	File,
	FileCode,
	FileJson,
	FileText,
	Image,
	Braces,
	FileType,
	Plus,
	Pencil,
	type LucideIcon,
} from 'lucide-react';

interface FileMentionPopupProps {
	files: string[];
	changedFiles?: Array<{
		path: string;
		status: string;
	}>;
	query: string;
	selectedIndex: number;
	onSelect: (file: string) => void;
	onEnterSelect: (file: string | undefined) => void;
	onClose: () => void;
}

function getFileIcon(filePath: string): LucideIcon {
	const ext = filePath.split('.').pop()?.toLowerCase();

	switch (ext) {
		case 'ts':
		case 'tsx':
		case 'js':
		case 'jsx':
		case 'mjs':
		case 'cjs':
		case 'py':
		case 'rb':
		case 'go':
		case 'rs':
		case 'java':
		case 'c':
		case 'cpp':
		case 'h':
		case 'hpp':
			return FileCode;
		case 'json':
		case 'yaml':
		case 'yml':
		case 'toml':
			return FileJson;
		case 'md':
		case 'txt':
		case 'log':
			return FileText;
		case 'png':
		case 'jpg':
		case 'jpeg':
		case 'gif':
		case 'svg':
		case 'webp':
			return Image;
		case 'css':
		case 'scss':
		case 'sass':
		case 'less':
			return Braces;
		case 'html':
		case 'xml':
			return FileType;
		default:
			return File;
	}
}

function getGitStatusInfo(
	filePath: string,
	changedFilesMap: Map<string, string>,
) {
	const status = changedFilesMap.get(filePath);
	if (!status) {
		return null;
	}

	const icons: Record<
		string,
		{ icon: LucideIcon; label: string; className: string }
	> = {
		added: { icon: Plus, label: 'Added', className: 'text-green-500' },
		modified: { icon: Pencil, label: 'Modified', className: 'text-yellow-500' },
		untracked: { icon: Plus, label: 'Untracked', className: 'text-blue-500' },
	};

	return (
		icons[status] || {
			icon: Pencil,
			label: 'Modified',
			className: 'text-yellow-500',
		}
	);
}

export function FileMentionPopup({
	files,
	changedFiles = [],
	query,
	selectedIndex,
	onSelect,
	onEnterSelect,
	onClose,
}: FileMentionPopupProps) {
	const changedFilesMap = useMemo(
		() => new Map(changedFiles?.map((f) => [f.path, f.status]) || []),
		[changedFiles],
	);

	const fuse = useMemo(
		() =>
			new Fuse(files, {
				threshold: 0.4,
				distance: 100,
				ignoreLocation: true,
				includeMatches: true,
			}),
		[files],
	);

	const results = useMemo(() => {
		if (!query) {
			return files.slice(0, 10);
		}
		const searchResults = fuse.search(query).map((r) => r.item);

		searchResults.sort((a, b) => {
			const aChanged = changedFilesMap.has(a);
			const bChanged = changedFilesMap.has(b);
			if (aChanged && !bChanged) return -1;
			if (!aChanged && bChanged) return 1;
			return 0;
		});

		return searchResults.slice(0, 10);
	}, [fuse, query, files, changedFilesMap]);

	useEffect(() => {
		const element = document.getElementById(`file-item-${selectedIndex}`);
		element?.scrollIntoView({ block: 'nearest' });
	}, [selectedIndex]);

	useEffect(() => {
		onEnterSelect(results[selectedIndex]);
	}, [results, selectedIndex, onEnterSelect]);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.closest('[data-file-mention-popup]')) {
				onClose();
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [onClose]);

	if (results.length === 0) {
		return (
			<div
				data-file-mention-popup
				className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-lg z-50 p-3"
			>
				<span className="text-muted-foreground text-sm">No files found</span>
			</div>
		);
	}

	return (
		<div
			data-file-mention-popup
			className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-lg max-h-[300px] overflow-y-auto z-50"
		>
			{results.map((filePath, index) => (
				<button
					type="button"
					key={filePath}
					id={`file-item-${index}`}
					onMouseDown={(e) => {
						e.preventDefault();
						onSelect(filePath);
					}}
					className={`w-full text-left px-3 py-2 hover:bg-accent ${
						index === selectedIndex ? 'bg-accent' : ''
					}`}
				>
					<div className="flex items-center gap-2 w-full">
						{(() => {
							const Icon = getFileIcon(filePath);
							return (
								<Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
							);
						})()}
						<span className="font-mono text-sm flex-1 truncate">
							{filePath}
						</span>
						{(() => {
							const status = getGitStatusInfo(filePath, changedFilesMap);
							return (
								status && (
									<status.icon
										className={`w-3.5 h-3.5 flex-shrink-0 ${status.className}`}
										title={status.label}
									/>
								)
							);
						})()}
					</div>
				</button>
			))}
		</div>
	);
}
