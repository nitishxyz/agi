import {
	useState,
	useEffect,
	useRef,
	useMemo,
	useImperativeHandle,
	forwardRef,
} from 'react';
import { ChevronDown, Search } from 'lucide-react';
import Fuse from 'fuse.js';

interface UnifiedAgentSelectorProps {
	agent: string;
	agents: string[];
	onChange: (agent: string) => void;
	disabled?: boolean;
}

export interface UnifiedAgentSelectorRef {
	openAndFocus: () => void;
}

export const UnifiedAgentSelector = forwardRef<
	UnifiedAgentSelectorRef,
	UnifiedAgentSelectorProps
>(function UnifiedAgentSelector(
	{ agent, agents, onChange, disabled = false },
	ref,
) {
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [highlightedIndex, setHighlightedIndex] = useState(0);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

	useImperativeHandle(ref, () => ({
		openAndFocus: () => {
			setIsOpen(true);
		},
	}));

	const fuse = useMemo(() => {
		return new Fuse(agents, {
			threshold: 0.4,
			ignoreLocation: true,
		});
	}, [agents]);

	const filteredAgents = useMemo(() => {
		if (!searchQuery.trim()) return agents;
		const results = fuse.search(searchQuery);
		return results.map((result) => result.item);
	}, [agents, searchQuery, fuse]);

	useEffect(() => {
		if (isOpen) {
			setHighlightedIndex(0);
		}
	}, [isOpen]);

	useEffect(() => {
		if (
			isOpen &&
			highlightedIndex >= 0 &&
			highlightedIndex < itemRefs.current.length
		) {
			itemRefs.current[highlightedIndex]?.scrollIntoView({
				block: 'nearest',
				behavior: 'smooth',
			});
		}
	}, [highlightedIndex, isOpen]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' || event.key === 'q') {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			document.addEventListener('keydown', handleEscape);
			setTimeout(() => searchInputRef.current?.focus(), 0);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isOpen]);

	const handleSelect = (selectedAgent: string) => {
		onChange(selectedAgent);
		setIsOpen(false);
		setSearchQuery('');
	};

	const handleSearchKeyDown = (event: React.KeyboardEvent) => {
		if (filteredAgents.length === 0) return;

		if (event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'j')) {
			event.preventDefault();
			setHighlightedIndex((prev) =>
				prev < filteredAgents.length - 1 ? prev + 1 : 0,
			);
		} else if (
			event.key === 'ArrowUp' ||
			(event.ctrlKey && event.key === 'k')
		) {
			event.preventDefault();
			setHighlightedIndex((prev) =>
				prev > 0 ? prev - 1 : filteredAgents.length - 1,
			);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const highlighted = filteredAgents[highlightedIndex];
			if (highlighted) {
				handleSelect(highlighted);
			}
		}
	};

	return (
		<div ref={dropdownRef} className="relative w-full">
			<button
				type="button"
				onClick={() => !disabled && setIsOpen(!isOpen)}
				disabled={disabled}
				className="w-full flex items-center justify-between px-3 py-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md hover:bg-[hsl(var(--accent))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				<span className="text-sm text-[hsl(var(--foreground))] truncate">
					{agent}
				</span>
				<ChevronDown
					className={`w-4 h-4 text-[hsl(var(--muted-foreground))] transition-transform ${isOpen ? 'rotate-180' : ''}`}
				/>
			</button>

			{isOpen && (
				<div className="absolute z-50 mt-1 w-full bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-md shadow-lg max-h-80 overflow-hidden flex flex-col">
					<div className="p-2 border-b border-[hsl(var(--border))]">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
							<input
								ref={searchInputRef}
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onKeyDown={handleSearchKeyDown}
								placeholder="Search agents..."
								className="w-full pl-9 pr-3 py-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded text-sm text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
							/>
						</div>
					</div>

					<div className="overflow-y-auto">
						{filteredAgents.length === 0 ? (
							<div className="p-4 text-center text-[hsl(var(--muted-foreground))] text-sm">
								No agents found
							</div>
						) : (
							filteredAgents.map((agentItem, index) => {
								const isSelected = agentItem === agent;
								const isHighlighted = index === highlightedIndex;

								return (
									<button
										key={agentItem}
										ref={(el) => {
											itemRefs.current[index] = el;
										}}
										type="button"
										onClick={() => handleSelect(agentItem)}
										onMouseEnter={() => setHighlightedIndex(index)}
										className={`w-full text-left px-4 py-2 text-sm transition-colors ${
											isHighlighted
												? 'bg-[hsl(var(--accent))]'
												: 'hover:bg-[hsl(var(--accent))]'
										} ${
											isSelected
												? 'text-[hsl(var(--accent-foreground))] font-medium'
												: 'text-[hsl(var(--foreground))]'
										}`}
									>
										<span className="truncate">{agentItem}</span>
									</button>
								);
							})
						)}
					</div>
				</div>
			)}
		</div>
	);
});
