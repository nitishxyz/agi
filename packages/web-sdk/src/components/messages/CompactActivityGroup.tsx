import { useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Search } from 'lucide-react';
import {
	type CompactActivityEntry,
	summarizeCompactActivities,
} from './compactActivity';

const ANIM_MS = 320;
const EASING = 'cubic-bezier(0.25, 1, 0.5, 1)';
const MAX_SCROLL_H = 140;

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
	const scrollRef = useRef<HTMLDivElement>(null);
	const hoveredRef = useRef(false);
	const prevCountRef = useRef(entries.length);

	const summary = useMemo(() => summarizeCompactActivities(entries), [entries]);
	const summaryTitle = titleOverride || summary.title;
	const summaryText = [summaryTitle, ...summary.details].join('\u00A0· ');
	const hasReasoning = entries.some((e) => e.toolName === 'reasoning');

	const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;

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

	// biome-ignore lint/correctness/useExhaustiveDependencies: auto-scroll on new entries or streaming text
	useEffect(() => {
		if (showSummary || hoveredRef.current || !scrollRef.current) return;
		const el = scrollRef.current;
		el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
	}, [entries.length, lastEntry?.fullText, showSummary]);

	useEffect(() => {
		prevCountRef.current = entries.length;
	}, [entries.length]);

	const isLive = !showSummary;

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
							maxHeight: isLive ? `${MAX_SCROLL_H + 28}px` : '0px',
							transition: `opacity ${ANIM_MS}ms ${EASING}, max-height ${ANIM_MS}ms ${EASING}`,
						}}
					>
						<div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70 mb-1">
							Exploring
						</div>

						<div
							ref={scrollRef}
							className="overflow-y-auto"
							style={{
								maxHeight: `${MAX_SCROLL_H}px`,
								maskImage:
									'linear-gradient(to bottom, transparent 0px, black 20px)',
								WebkitMaskImage:
									'linear-gradient(to bottom, transparent 0px, black 20px)',
							}}
							role="log"
							onMouseEnter={() => {
								hoveredRef.current = true;
							}}
							onMouseLeave={() => {
								hoveredRef.current = false;
							}}
						>
							{entries.map((entry, i) => {
								const isLast = i === entries.length - 1;
								const isNewAppend = i >= prevCountRef.current;
								const isReasoning = entry.toolName === 'reasoning';
								const showFullText =
									isReasoning && entry.fullText && entry.fullText.trim();

								if (showFullText) {
									return (
										<div
											key={entry.id}
											className="px-1 py-0.5"
											style={{
												animation: isNewAppend
													? `ottoEntryIn ${ANIM_MS}ms ${EASING} both`
													: undefined,
											}}
										>
											<p
												className={`text-[11px] leading-relaxed font-mono whitespace-pre-wrap ${
													isLast
														? 'text-foreground/80'
														: 'text-muted-foreground/60'
												}`}
											>
												{entry.fullText}
											</p>
										</div>
									);
								}

								return (
									<div
										key={entry.id}
										className={`flex items-center px-1 text-xs leading-5 h-7 ${
											isLast ? 'text-foreground' : 'text-muted-foreground/70'
										}`}
										style={{
											animation: isNewAppend
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
