import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useAllModels } from '../../hooks/useConfig';

interface UnifiedModelSelectorProps {
	provider: string;
	model: string;
	onChange: (provider: string, model: string) => void;
	disabled?: boolean;
}

export function UnifiedModelSelector({
	provider,
	model,
	onChange,
	disabled = false,
}: UnifiedModelSelectorProps) {
	const { data: allModels, isLoading } = useAllModels();
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const dropdownRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

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
			setTimeout(() => searchInputRef.current?.focus(), 0);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isOpen]);

	const filteredModels = useMemo(() => {
		if (!allModels) return {};
		if (!searchQuery.trim()) return allModels;

		const query = searchQuery.toLowerCase();
		const filtered: typeof allModels = {};

		for (const [providerKey, providerData] of Object.entries(allModels)) {
			const providerMatches = providerData.label.toLowerCase().includes(query);
			const matchingModels = providerData.models.filter(
				(m) =>
					providerMatches ||
					m.label.toLowerCase().includes(query) ||
					m.id.toLowerCase().includes(query),
			);

			if (matchingModels.length > 0) {
				filtered[providerKey] = {
					label: providerData.label,
					models: matchingModels,
				};
			}
		}

		return filtered;
	}, [allModels, searchQuery]);

	const handleSelect = (selectedProvider: string, selectedModel: string) => {
		onChange(selectedProvider, selectedModel);
		setIsOpen(false);
		setSearchQuery('');
	};

	const handleKeyDown = (
		event: React.KeyboardEvent,
		selectedProvider: string,
		selectedModel: string,
	) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleSelect(selectedProvider, selectedModel);
		}
	};

	const currentProviderLabel = allModels?.[provider]?.label || provider;
	const currentModelLabel =
		allModels?.[provider]?.models.find((m) => m.id === model)?.label || model;

	return (
		<div ref={dropdownRef} className="relative w-full">
			<button
				type="button"
				onClick={() => !disabled && setIsOpen(!isOpen)}
				disabled={disabled || isLoading}
				className="w-full flex items-center justify-between px-3 py-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md hover:bg-[hsl(var(--accent))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				<span className="flex items-center gap-2 text-sm truncate">
					<span className="text-[hsl(var(--muted-foreground))]">
						{currentProviderLabel}
					</span>
					<span className="text-[hsl(var(--muted-foreground))]/50">/</span>
					<span className="text-[hsl(var(--foreground))]">
						{currentModelLabel}
					</span>
				</span>
				<ChevronDown
					className={`w-4 h-4 text-[hsl(var(--muted-foreground))] transition-transform ${isOpen ? 'rotate-180' : ''}`}
				/>
			</button>

			{isOpen && !isLoading && allModels && (
				<div className="absolute z-50 mt-1 w-full bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-md shadow-lg max-h-80 overflow-hidden flex flex-col">
					<div className="p-2 border-b border-[hsl(var(--border))]">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
							<input
								ref={searchInputRef}
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search providers and models..."
								className="w-full pl-9 pr-3 py-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded text-sm text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
							/>
						</div>
					</div>

					<div className="overflow-y-auto">
						{Object.keys(filteredModels).length === 0 ? (
							<div className="p-4 text-center text-[hsl(var(--muted-foreground))] text-sm">
								No models found
							</div>
						) : (
							Object.entries(filteredModels).map(
								([providerKey, providerData]) => (
									<div
										key={providerKey}
										className="border-b border-[hsl(var(--border))] last:border-0"
									>
										<div className="px-3 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider bg-[hsl(var(--muted))]">
											{providerData.label}
										</div>
										<div>
											{providerData.models.map((modelItem) => {
												const isSelected =
													providerKey === provider && modelItem.id === model;
												return (
													<button
														key={modelItem.id}
														type="button"
														onClick={() =>
															handleSelect(providerKey, modelItem.id)
														}
														onKeyDown={(e) =>
															handleKeyDown(e, providerKey, modelItem.id)
														}
														className={`w-full text-left px-4 py-2 text-sm hover:bg-[hsl(var(--accent))] flex items-center justify-between transition-colors ${
															isSelected
																? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-medium'
																: 'text-[hsl(var(--foreground))]'
														}`}
													>
														<span className="truncate">{modelItem.label}</span>
														{(modelItem.toolCall || modelItem.reasoning) && (
															<div className="flex gap-1 ml-2 flex-shrink-0">
																{modelItem.toolCall && (
																	<span className="text-[10px] px-1.5 py-0.5 bg-green-600/20 text-green-400 rounded">
																		Tools
																	</span>
																)}
																{modelItem.reasoning && (
																	<span className="text-[10px] px-1.5 py-0.5 bg-purple-600/20 text-purple-400 rounded">
																		Reasoning
																	</span>
																)}
															</div>
														)}
													</button>
												);
											})}
										</div>
									</div>
								),
							)
						)}
					</div>
				</div>
			)}
		</div>
	);
}
