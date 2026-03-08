import { useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Search } from 'lucide-react';
import {
	type CompactActivityEntry,
	summarizeCompactActivities,
} from './compactActivity';

const MAX_VISIBLE = 3;
const ROW_H = 28;
const ROW_GAP = 2;
const STEP = ROW_H + ROW_GAP;
const ANIM_MS = 320;
const EASING = 'cubic-bezier(0.25, 1, 0.5, 1)';

interface CompactActivityGroupProps {
	entries: CompactActivityEntry[];
	titleOverride?: string;
	showLine: boolean;
	collapsed: boolean;
}

export function CompactActivityGroup({
	entries,
	titleOverride,
	showLine,
	collapsed,
}: CompactActivityGroupProps) {
	const mountedCollapsed = collapsed && entries.length > 0;
	const [showSummary, setShowSummary] = useState(mountedCollapsed);
	const [latched, setLatched] = useState(mountedCollapsed);
	const [rendered, setRendered] = useState<CompactActivityEntry[]>(() =>
		entries.slice(-MAX_VISIBLE),
	);
	const [slideOffset, setSlideOffset] = useState(0);
	const [isSliding, setIsSliding] = useState(false);
	const [newIds, setNewIds] = useState<Set<string>>(new Set());
	const [animHeight, setAnimHeight] = useState(0);
	const prevEntriesRef = useRef(entries);
	const settleRef = useRef<number | undefined>(undefined);
	const clearNewRef = useRef<number | undefined>(undefined);

	const summary = useMemo(() => summarizeCompactActivities(entries), [entries]);
	const summaryTitle = titleOverride || summary.title;
	const summaryText = [summaryTitle, ...summary.details].join('\u00A0· ');
	const hasReasoning = entries.some((e) => e.toolName === 'reasoning');

	const visibleCount = Math.min(MAX_VISIBLE, entries.length);
	const targetH =
		visibleCount * ROW_H + Math.max(0, visibleCount - 1) * ROW_GAP;

	useEffect(() => {
		if (!collapsed && !latched) {
			setShowSummary(false);
			return;
		}
		if (!latched && collapsed) {
			setLatched(true);
		}
		if (showSummary) return;
		if (entries.length === 0) return;
		const t = window.setTimeout(() => setShowSummary(true), 500);
		return () => window.clearTimeout(t);
	}, [collapsed, showSummary, latched, entries.length]);

	useEffect(() => {
		if (showSummary) return;

		requestAnimationFrame(() => {
			setAnimHeight(targetH);
		});
	}, [targetH, showSummary]);

	useEffect(() => {
		if (settleRef.current) {
			window.clearTimeout(settleRef.current);
			settleRef.current = undefined;
		}
		if (clearNewRef.current) {
			window.clearTimeout(clearNewRef.current);
			clearNewRef.current = undefined;
		}

		const prev = prevEntriesRef.current;
		prevEntriesRef.current = entries;
		const nextVisible = entries.slice(-MAX_VISIBLE);

		if (showSummary) {
			setRendered(nextVisible);
			setNewIds(new Set());
			setSlideOffset(0);
			setIsSliding(false);
			return;
		}

		const isAppend =
			entries.length > prev.length &&
			prev.every((e, i) => e.id === entries[i]?.id);
		const appendedCount = isAppend ? entries.length - prev.length : 0;

		if (appendedCount === 0) {
			setRendered(nextVisible);
			setNewIds(new Set());
			setSlideOffset(0);
			setIsSliding(false);
			return;
		}

		const incoming = new Set(entries.slice(prev.length).map((e) => e.id));
		setNewIds(incoming);
		clearNewRef.current = window.setTimeout(() => {
			setNewIds(new Set());
			clearNewRef.current = undefined;
		}, ANIM_MS + 60);

		const needsSlide = prev.length >= MAX_VISIBLE;

		if (!needsSlide) {
			setRendered(nextVisible);
			setSlideOffset(0);
			setIsSliding(false);
			return;
		}

		const slideCount = Math.min(appendedCount, MAX_VISIBLE);
		const prevVisible = prev.slice(-MAX_VISIBLE);
		const combined = [...prevVisible, ...nextVisible.slice(-slideCount)];
		const uniqueMap = new Map<string, CompactActivityEntry>();
		for (const e of combined) uniqueMap.set(e.id, e);
		const deduped = Array.from(uniqueMap.values());

		setRendered(deduped);
		setSlideOffset(0);
		setIsSliding(false);

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				setIsSliding(true);
				setSlideOffset(-(slideCount * STEP));
			});
		});

		settleRef.current = window.setTimeout(() => {
			setRendered(nextVisible);
			setSlideOffset(0);
			setIsSliding(false);
			settleRef.current = undefined;
		}, ANIM_MS + 10);
	}, [entries, showSummary]);

	useEffect(() => {
		return () => {
			if (settleRef.current) window.clearTimeout(settleRef.current);
			if (clearNewRef.current) window.clearTimeout(clearNewRef.current);
		};
	}, []);

	const isLive = !showSummary;
	const showMask = entries.length > MAX_VISIBLE;

	return (
		<div className="flex gap-3 pb-2 relative max-w-full overflow-hidden">
			<div className="flex-shrink-0 w-6 flex items-start justify-center relative pt-0.5">
				<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full relative bg-background">
					{hasReasoning ? (
						<Brain className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
					) : (
						<Search className="h-4 w-4 text-amber-600 dark:text-amber-300" />
					)}
				</div>
				{showLine && (
					<div
						className="absolute left-1/2 -translate-x-1/2 w-[2px] bg-border z-0"
						style={{ top: '1.25rem', bottom: '-0.5rem' }}
					/>
				)}
			</div>

			<div className="flex-1 min-w-0 pt-0.5">
				<div
					className="relative rounded-lg overflow-hidden"
					style={{
						border: isLive
							? '1px solid hsl(var(--border) / 0.6)'
							: '1px solid transparent',
						background: isLive ? 'hsl(var(--muted) / 0.2)' : 'transparent',
						padding: isLive ? '8px 12px' : '0px 0px',
						transition: `border ${ANIM_MS}ms ${EASING}, background ${ANIM_MS}ms ${EASING}, padding ${ANIM_MS}ms ${EASING}`,
					}}
				>
					<div
						style={{
							overflow: 'hidden',
							opacity: isLive ? 1 : 0,
							maxHeight: isLive ? `${animHeight + 20}px` : '0px',
							transition: `opacity ${ANIM_MS}ms ${EASING}, max-height ${ANIM_MS}ms ${EASING}`,
						}}
					>
						<div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70 mb-1">
							Exploring
						</div>
						<div
							className="relative overflow-hidden"
							style={{
								height: `${animHeight}px`,
								transition: `height ${ANIM_MS}ms ${EASING}`,
								maskImage: showMask
									? 'linear-gradient(to bottom, transparent, black 30%, black 100%)'
									: undefined,
								WebkitMaskImage: showMask
									? 'linear-gradient(to bottom, transparent, black 30%, black 100%)'
									: undefined,
							}}
						>
							<div
								className="will-change-transform"
								style={{
									transform: `translateY(${slideOffset}px)`,
									transition: isSliding
										? `transform ${ANIM_MS}ms ${EASING}`
										: 'none',
								}}
							>
								{rendered.map((entry, i) => {
									const isNew = newIds.has(entry.id);
									const isLatest = entry.id === entries[entries.length - 1]?.id;
									return (
										<div
											key={entry.id}
											className={`flex items-center px-1 text-xs leading-5 ${
												isLatest
													? 'text-foreground'
													: 'text-muted-foreground/70'
											}`}
											style={{
												height: `${ROW_H}px`,
												marginTop: i === 0 ? 0 : `${ROW_GAP}px`,
												animation: isNew
													? `ottoEntryIn ${ANIM_MS}ms ${EASING} both`
													: undefined,
											}}
										>
											<span className="block min-w-0 truncate">
												{entry.label}
											</span>
										</div>
									);
								})}
							</div>
						</div>
					</div>

					<div
						className="flex items-center text-xs"
						style={{
							opacity: showSummary ? 1 : 0,
							height: showSummary ? '20px' : '0px',
							overflow: 'hidden',
							transition: `opacity ${ANIM_MS}ms ${EASING}, height ${ANIM_MS}ms ${EASING}`,
						}}
					>
						<span
							className="block min-w-0 truncate leading-5 text-foreground"
							title={summaryText}
						>
							{summaryText}
						</span>
					</div>
				</div>
			</div>

			<style>{`@keyframes ottoEntryIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
		</div>
	);
}
