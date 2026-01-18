import { useEffect, useMemo } from 'react';
import { usePreferences } from '../../hooks/usePreferences';
import { filterCommands, getCommandDescription } from '../../lib/commands';

interface CommandSuggestionsPopupProps {
	query: string;
	selectedIndex: number;
	onSelect: (commandId: string) => void;
	onEnterSelect: (commandId: string | undefined) => void;
	onClose: () => void;
}

export function CommandSuggestionsPopup({
	query,
	selectedIndex,
	onSelect,
	onEnterSelect,
	onClose,
}: CommandSuggestionsPopupProps) {
	const { preferences } = usePreferences();

	const state = useMemo(
		() => ({
			vimModeEnabled: preferences.vimMode,
			reasoningEnabled: preferences.reasoningEnabled,
		}),
		[preferences.vimMode, preferences.reasoningEnabled],
	);

	const results = useMemo(() => filterCommands(query, state), [query, state]);

	useEffect(() => {
		const element = document.getElementById(`command-item-${selectedIndex}`);
		element?.scrollIntoView({ block: 'nearest' });
	}, [selectedIndex]);

	useEffect(() => {
		onEnterSelect(results[selectedIndex]?.id);
	}, [results, selectedIndex, onEnterSelect]);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.closest('[data-command-popup]')) {
				onClose();
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [onClose]);

	if (results.length === 0) {
		return (
			<div
				data-command-popup
				className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-lg z-50 p-3"
			>
				<span className="text-muted-foreground text-sm">No commands found</span>
			</div>
		);
	}

	return (
		<div
			data-command-popup
			className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-lg max-h-[300px] overflow-y-auto z-50"
		>
			{results.map((command, index) => {
				const Icon = command.icon;
				return (
					<button
						type="button"
						key={command.id}
						id={`command-item-${index}`}
						onMouseDown={(e) => {
							e.preventDefault();
							onSelect(command.id);
						}}
						className={`w-full text-left px-3 py-2 hover:bg-accent ${
							index === selectedIndex ? 'bg-accent' : ''
						}`}
					>
						<div className="flex items-center gap-3 w-full">
							<Icon className="w-4 h-4 flex-shrink-0 text-primary" />
							<div className="flex-1 min-w-0">
								<div className="font-mono text-sm font-medium text-foreground">
									{command.label}
								</div>
								<div className="text-xs text-muted-foreground truncate">
									{getCommandDescription(command, state)}
								</div>
							</div>
						</div>
					</button>
				);
			})}
		</div>
	);
}
