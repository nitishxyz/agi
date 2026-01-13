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
import { useAllModels } from '../../hooks/useConfig';

interface UnifiedModelSelectorProps {
	provider: string;
	model: string;
	onChange: (provider: string, model: string) => void;
	disabled?: boolean;
}

interface FlattenedModel {
	providerKey: string;
	providerLabel: string;
	modelId: string;
	modelLabel: string;
	toolCall?: boolean;
	reasoning?: boolean;
}

export interface UnifiedModelSelectorRef {
	openAndFocus: () => void;
}

export const UnifiedModelSelector = forwardRef<
	UnifiedModelSelectorRef,
	UnifiedModelSelectorProps
>(function UnifiedModelSelector(
	{ provider, model, onChange, disabled = false },
	ref,
) {
	const { data: allModels, isLoading } = useAllModels();
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

	const flattenedModels = useMemo(() => {
		if (!allModels) return [];
		const flattened: FlattenedModel[] = [];
		for (const [providerKey, providerData] of Object.entries(allModels)) {
			for (const modelItem of providerData.models) {
				flattened.push({
					providerKey,
					providerLabel: providerData.label,
					modelId: modelItem.id,
					modelLabel: modelItem.label,
					toolCall: modelItem.toolCall,
					reasoning: modelItem.reasoning,
				});
			}
		}
		return flattened;
	}, [allModels]);

	const fuse = useMemo(() => {
		return new Fuse(flattenedModels, {
			keys: [
				{ name: 'modelLabel', weight: 1 },
				{ name: 'modelId', weight: 0.5 },
				{ name: 'providerLabel', weight: 0.3 },
			],
			threshold: 0.5,
			ignoreLocation: true,
			includeScore: true,
			distance: 100,
			minMatchCharLength: 1,
			findAllMatches: true,
		});
	}, [flattenedModels]);

	const filteredModels = useMemo(() => {
		if (!allModels) return {};
		if (!searchQuery.trim()) return allModels;

		const results = fuse.search(searchQuery);

		const sortedResults = results.sort((a, b) => {
			const scoreA = a.score ?? 1;
			const scoreB = b.score ?? 1;
			if (Math.abs(scoreA - scoreB) < 0.001) {
				const labelA = a.item.modelLabel.toLowerCase();
				const labelB = b.item.modelLabel.toLowerCase();
				const query = searchQuery.toLowerCase();
				const indexA = labelA.indexOf(query);
				const indexB = labelB.indexOf(query);
				if (indexA >= 0 && indexB < 0) return -1;
				if (indexB >= 0 && indexA < 0) return 1;
				if (indexA >= 0 && indexB >= 0) return indexA - indexB;
			}
			return scoreA - scoreB;
		});

		const filtered: typeof allModels = {};

		for (const result of sortedResults) {
			const item = result.item;

			if (!filtered[item.providerKey]) {
				filtered[item.providerKey] = {
					label: item.providerLabel,
					models: [],
				};
			}

			const existingModel = filtered[item.providerKey].models.find(
				(m) => m.id === item.modelId,
			);
			if (!existingModel) {
				filtered[item.providerKey].models.push({
					id: item.modelId,
					label: item.modelLabel,
					toolCall: item.toolCall,
					reasoning: item.reasoning,
				});
			}
		}

		return filtered;
	}, [allModels, searchQuery, fuse]);

	const filteredFlatList = useMemo(() => {
		const list: FlattenedModel[] = [];
		for (const [providerKey, providerData] of Object.entries(filteredModels)) {
			for (const modelItem of providerData.models) {
				list.push({
					providerKey,
					providerLabel: providerData.label,
					modelId: modelItem.id,
					modelLabel: modelItem.label,
					toolCall: modelItem.toolCall,
					reasoning: modelItem.reasoning,
				});
			}
		}
		return list;
	}, [filteredModels]);

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
			const target = event.target as HTMLElement;
			const isInInput =
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable;
			if (event.key === 'Escape' || (event.key === 'q' && !isInInput)) {
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

	const handleSelect = (selectedProvider: string, selectedModel: string) => {
		onChange(selectedProvider, selectedModel);
		setIsOpen(false);
		setSearchQuery('');
	};

	const handleSearchKeyDown = (event: React.KeyboardEvent) => {
		if (filteredFlatList.length === 0) return;

		if (event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'j')) {
			event.preventDefault();
			setHighlightedIndex((prev) =>
				prev < filteredFlatList.length - 1 ? prev + 1 : 0,
			);
		} else if (
			event.key === 'ArrowUp' ||
			(event.ctrlKey && event.key === 'k')
		) {
			event.preventDefault();
			setHighlightedIndex((prev) =>
				prev > 0 ? prev - 1 : filteredFlatList.length - 1,
			);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const highlighted = filteredFlatList[highlightedIndex];
			if (highlighted) {
				handleSelect(highlighted.providerKey, highlighted.modelId);
			}
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
								onKeyDown={handleSearchKeyDown}
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
												const flatIndex = filteredFlatList.findIndex(
													(item) =>
														item.providerKey === providerKey &&
														item.modelId === modelItem.id,
												);
												const isHighlighted = flatIndex === highlightedIndex;

												return (
													<button
														key={modelItem.id}
														ref={(el) => {
															if (flatIndex >= 0) {
																itemRefs.current[flatIndex] = el;
															}
														}}
														type="button"
														onClick={() =>
															handleSelect(providerKey, modelItem.id)
														}
														onMouseEnter={() => setHighlightedIndex(flatIndex)}
														className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors ${
															isHighlighted
																? 'bg-[hsl(var(--accent))]'
																: 'hover:bg-[hsl(var(--accent))]'
														} ${
															isSelected
																? 'text-[hsl(var(--accent-foreground))] font-medium'
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
});
