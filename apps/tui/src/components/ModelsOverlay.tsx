import { useKeyboard, useRenderer } from '@opentui/react';
import { TextareaRenderable } from '@opentui/core';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { getAllModels } from '@ottocode/api';
import { useTheme } from '../theme.ts';

interface ModelItem {
	id: string;
	label: string;
	toolCall?: boolean;
	reasoningText?: boolean;
}

interface ProviderModels {
	label: string;
	models: ModelItem[];
}

type AllModels = Record<string, ProviderModels>;

interface FlatItem {
	providerKey: string;
	providerLabel: string;
	modelId: string;
	modelLabel: string;
	toolCall?: boolean;
	reasoningText?: boolean;
}

interface ModelsOverlayProps {
	currentProvider: string;
	currentModel: string;
	onClose: () => void;
	onSelect: (provider: string, model: string) => void;
}

export function ModelsOverlay({
	currentProvider,
	currentModel,
	onClose,
	onSelect,
}: ModelsOverlayProps) {
	const { colors } = useTheme();
	const renderer = useRenderer();
	const [allModels, setAllModels] = useState<AllModels | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedIdx, setSelectedIdx] = useState(0);
	const selectedIdxRef = useRef(selectedIdx);
	selectedIdxRef.current = selectedIdx;
	const textareaRef = useRef<TextareaRenderable | null>(null);
	const containerRef = useRef<string>(`models-search-${Date.now()}`);
	const scrollOffsetRef = useRef(0);
	const [scrollOffset, setScrollOffset] = useState(0);

	useEffect(() => {
		getAllModels().then((res) => {
			// biome-ignore lint/suspicious/noExplicitAny: SDK response type
			const data = res.data as any;
			if (data) setAllModels(data);
		});
	}, []);

	const flattenedModels = useMemo(() => {
		if (!allModels) return [];
		const items: FlatItem[] = [];
		for (const [providerKey, providerData] of Object.entries(allModels)) {
			for (const m of providerData.models) {
				items.push({
					providerKey,
					providerLabel: providerData.label,
					modelId: m.id,
					modelLabel: m.label,
					toolCall: m.toolCall,
					reasoningText: m.reasoningText,
				});
			}
		}
		return items;
	}, [allModels]);

	const fuse = useMemo(
		() =>
			new Fuse(flattenedModels, {
				keys: [
					{ name: 'modelLabel', weight: 2 },
					{ name: 'modelId', weight: 1 },
					{ name: 'providerLabel', weight: 0.5 },
				],
				threshold: 0.3,
				ignoreLocation: true,
				includeScore: true,
				distance: 100,
				minMatchCharLength: 1,
			}),
		[flattenedModels],
	);

	const filteredModels = useMemo((): AllModels => {
		if (!allModels) return {};
		if (!searchQuery.trim()) return allModels;

		const results = fuse.search(searchQuery);
		const filtered: AllModels = {};

		for (const result of results) {
			const item = result.item;
			if (!filtered[item.providerKey]) {
				filtered[item.providerKey] = {
					label: item.providerLabel,
					models: [],
				};
			}
			const exists = filtered[item.providerKey].models.find(
				(m) => m.id === item.modelId,
			);
			if (!exists) {
				filtered[item.providerKey].models.push({
					id: item.modelId,
					label: item.modelLabel,
					toolCall: item.toolCall,
					reasoningText: item.reasoningText,
				});
			}
		}
		return filtered;
	}, [allModels, searchQuery, fuse]);

	const flatList = useMemo(() => {
		const list: FlatItem[] = [];
		for (const [providerKey, providerData] of Object.entries(filteredModels)) {
			for (const m of providerData.models) {
				list.push({
					providerKey,
					providerLabel: providerData.label,
					modelId: m.id,
					modelLabel: m.label,
					toolCall: m.toolCall,
					reasoningText: m.reasoningText,
				});
			}
		}
		return list;
	}, [filteredModels]);

	const flatListRef = useRef(flatList);
	flatListRef.current = flatList;

	useEffect(() => {
		setSelectedIdx(0);
		scrollOffsetRef.current = 0;
		setScrollOffset(0);
	}, [searchQuery]);

	const VISIBLE_ROWS = 20;

	const ensureVisible = useCallback((idx: number) => {
		let offset = scrollOffsetRef.current;
		if (idx < offset) {
			offset = idx;
		} else if (idx >= offset + VISIBLE_ROWS) {
			offset = idx - VISIBLE_ROWS + 1;
		}
		scrollOffsetRef.current = offset;
		setScrollOffset(offset);
	}, []);

	const handleContentChange = useCallback(() => {
		if (!textareaRef.current) return;
		setSearchQuery(textareaRef.current.plainText);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: textarea is created once
	useEffect(() => {
		const container = renderer.root.findDescendantById(containerRef.current);
		if (!container || textareaRef.current) return;

		const textarea = new TextareaRenderable(renderer, {
			id: 'models-search-textarea',
			width: '100%',
			height: 1,
			placeholder: 'Search models…',
			placeholderColor: colors.fgDark,
			textColor: colors.fgBright,
			focusedTextColor: colors.fgBright,
			cursorColor: colors.blue,
			wrapMode: 'word',
			keyBindings: [],
		});

		textarea.onContentChange = handleContentChange;
		container.add(textarea);
		textareaRef.current = textarea;
		textarea.focus();

		return () => {
			if (textareaRef.current) {
				textareaRef.current.destroy();
				textareaRef.current = null;
			}
		};
	}, [renderer, handleContentChange]);

	useKeyboard((key) => {
		const list = flatListRef.current;
		if (list.length === 0) return;

		if (key.name === 'up' || (key.ctrl && key.name === 'k')) {
			const next =
				selectedIdxRef.current <= 0
					? list.length - 1
					: selectedIdxRef.current - 1;
			setSelectedIdx(next);
			ensureVisible(next);
		} else if (key.name === 'down' || (key.ctrl && key.name === 'j')) {
			const next =
				selectedIdxRef.current >= list.length - 1
					? 0
					: selectedIdxRef.current + 1;
			setSelectedIdx(next);
			ensureVisible(next);
		} else if (key.name === 'return') {
			const item = list[selectedIdxRef.current];
			if (item) onSelect(item.providerKey, item.modelId);
		} else if (key.name === 'escape') {
			onClose();
		}
	});

	type DisplayRow =
		| { type: 'header'; providerKey: string; label: string }
		| { type: 'model'; flatIndex: number; item: FlatItem };

	const displayRows = useMemo(() => {
		const rows: DisplayRow[] = [];
		let lastProvider = '';
		for (let i = 0; i < flatList.length; i++) {
			const item = flatList[i];
			if (item.providerKey !== lastProvider) {
				rows.push({
					type: 'header',
					providerKey: item.providerKey,
					label: item.providerLabel,
				});
				lastProvider = item.providerKey;
			}
			rows.push({ type: 'model', flatIndex: i, item });
		}
		return rows;
	}, [flatList]);

	const visibleDisplayRows = useMemo(() => {
		let modelCount = 0;
		let startRowIdx = 0;
		for (let i = 0; i < displayRows.length; i++) {
			if (displayRows[i].type === 'model') {
				if (modelCount === scrollOffset) {
					startRowIdx = i;
					if (i > 0 && displayRows[i - 1].type === 'header') {
						startRowIdx = i - 1;
					}
					break;
				}
				modelCount++;
			}
		}

		const result: DisplayRow[] = [];
		let visibleModels = 0;
		for (
			let i = startRowIdx;
			i < displayRows.length && visibleModels < VISIBLE_ROWS;
			i++
		) {
			result.push(displayRows[i]);
			if (displayRows[i].type === 'model') visibleModels++;
		}
		return result;
	}, [displayRows, scrollOffset]);

	return (
		<box
			style={{
				position: 'absolute',
				top: Math.floor((process.stdout.rows ?? 40) * 0.1),
				left: Math.floor((process.stdout.columns ?? 120) * 0.15),
				right: Math.floor((process.stdout.columns ?? 120) * 0.15),
				bottom: Math.floor((process.stdout.rows ?? 40) * 0.1),
				border: true,
				borderStyle: 'rounded',
				borderColor: colors.border,
				backgroundColor: colors.bg,
				zIndex: 100,
				flexDirection: 'column',
				padding: 1,
			}}
			title=" Models "
		>
			<box
				style={{
					width: '100%',
					height: 3,
					flexShrink: 0,
					border: true,
					borderStyle: 'rounded',
					borderColor: colors.border,
					marginBottom: 1,
				}}
			>
				<box style={{ flexDirection: 'row', width: '100%', height: 1 }}>
					<text fg={colors.fgDark}>🔍 </text>
					<box id={containerRef.current} style={{ width: '100%', height: 1 }} />
				</box>
			</box>

			{!allModels && <text fg={colors.fgDark}>Loading models…</text>}

			{allModels && flatList.length === 0 && searchQuery && (
				<text fg={colors.fgDark}>No models found</text>
			)}

			{flatList.length > 0 && (
				<box
					style={{ flexDirection: 'column', overflow: 'hidden', flexGrow: 1 }}
				>
					{visibleDisplayRows.map((row, i) => {
						if (row.type === 'header') {
							return (
								<box
									key={`h-${row.providerKey}`}
									style={{ height: 1, width: '100%' }}
								>
									<text fg={colors.fgDark}>
										<b>{row.label.toUpperCase()}</b>
									</text>
								</box>
							);
						}
						const isSelected = row.flatIndex === selectedIdx;
						const isCurrent =
							row.item.providerKey === currentProvider &&
							row.item.modelId === currentModel;
						const badges: string[] = [];
						if (row.item.toolCall) badges.push('tools');
						if (row.item.reasoningText) badges.push('reasoning');
						return (
							<box
								key={`m-${row.item.providerKey}-${row.item.modelId}`}
								style={{
									flexDirection: 'row',
									gap: 1,
									height: 1,
									width: '100%',
									backgroundColor: isSelected ? colors.bgHighlight : undefined,
									paddingLeft: 1,
								}}
							>
								<text fg={isSelected ? colors.fgBright : colors.fgMuted}>
									{row.item.modelLabel}
								</text>
								{isCurrent && <text fg={colors.blue}>●</text>}
								{badges.length > 0 && (
									<text fg={colors.fgDark}>{badges.join(' ')}</text>
								)}
							</box>
						);
					})}
				</box>
			)}

			<text fg={colors.fgDimmed}>↑↓ nav · ↵ select · esc close</text>
		</box>
	);
}
