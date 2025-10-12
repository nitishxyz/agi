import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface UnifiedAgentSelectorProps {
	agent: string;
	agents: string[];
	onChange: (agent: string) => void;
	disabled?: boolean;
}

export function UnifiedAgentSelector({
	agent,
	agents,
	onChange,
	disabled = false,
}: UnifiedAgentSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

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
			if (event.key === 'Escape') {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			document.addEventListener('keydown', handleEscape);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isOpen]);

	const handleSelect = (selectedAgent: string) => {
		onChange(selectedAgent);
		setIsOpen(false);
	};

	const handleKeyDown = (event: React.KeyboardEvent, selectedAgent: string) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleSelect(selectedAgent);
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
				<div className="absolute z-50 mt-1 w-full bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-md shadow-lg max-h-80 overflow-y-auto">
					{agents.map((agentItem) => {
						const isSelected = agentItem === agent;
						return (
							<button
								key={agentItem}
								type="button"
								onClick={() => handleSelect(agentItem)}
								onKeyDown={(e) => handleKeyDown(e, agentItem)}
								className={`w-full text-left px-4 py-2 text-sm hover:bg-[hsl(var(--accent))] transition-colors ${
									isSelected
										? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-medium'
										: 'text-[hsl(var(--foreground))]'
								}`}
							>
								<span className="truncate">{agentItem}</span>
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
