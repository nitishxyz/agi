import { useEffect, useState, useRef, useCallback } from 'react';
import { Reveal } from '../../components/Reveal';
import { ProviderLogo } from '../../components/ProviderLogo';

const SHARE_TEXT = '/share';
const TYPE_INTERVAL = 120;
const SEND_DELAY = 500;
const LOADING_DURATION = 1200;
const RESTART_DELAY = 5000;

function ShareMockup() {
	const containerRef = useRef<HTMLDivElement>(null);
	const [inView, setInView] = useState(false);
	const [typed, setTyped] = useState('');
	const [phase, setPhase] = useState<
		'idle' | 'typing' | 'sent' | 'loading' | 'toast'
	>('idle');
	const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const obs = new IntersectionObserver(
			([e]) => {
				if (e.isIntersecting) setInView(true);
			},
			{ threshold: 0.4 },
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, []);

	useEffect(() => {
		if (!inView) return;
		if (phase !== 'idle') return;
		start();
	}, [inView, phase]);

	useEffect(() => {
		return () => timeouts.current.forEach(clearTimeout);
	}, []);

	function later(fn: () => void, ms: number) {
		timeouts.current.push(setTimeout(fn, ms));
	}

	function start() {
		setPhase('typing');
		setTyped('');
		for (let i = 0; i < SHARE_TEXT.length; i++) {
			later(() => setTyped(SHARE_TEXT.slice(0, i + 1)), i * TYPE_INTERVAL);
		}
		const afterType = SHARE_TEXT.length * TYPE_INTERVAL + SEND_DELAY;
		later(() => {
			setPhase('sent');
			setTyped('');
		}, afterType);
		later(() => setPhase('loading'), afterType + 100);
		later(() => setPhase('toast'), afterType + 100 + LOADING_DURATION);
		later(
			() => setPhase('idle'),
			afterType + 100 + LOADING_DURATION + RESTART_DELAY,
		);
	}

	return (
		<div
			ref={containerRef}
			className="bg-otto-surface border border-otto-border rounded-lg overflow-hidden shadow-2xl shadow-black/10 dark:shadow-black/50 relative"
		>
			<div className="h-12 border-b border-otto-border bg-otto-surface/95 flex items-center justify-between px-5">
				<div className="flex items-center gap-2 text-sm text-otto-muted">
					<svg
						className="w-3.5 h-3.5 flex-shrink-0"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
					</svg>
					<span className="text-otto-text font-medium text-xs truncate">
						Refactor auth module
					</span>
				</div>
				<div className="flex-shrink-0 flex items-center gap-4 text-xs text-otto-muted">
					<div className="hidden sm:flex items-center gap-1.5">
						<ProviderLogo
							provider="anthropic"
							size={14}
							className="text-[#cc785c]"
						/>
						<span className="font-medium text-otto-text">claude-sonnet-4</span>
					</div>
				</div>
			</div>

			<div className="px-5 py-4 space-y-5 min-h-[260px]">
				<div className="flex justify-end">
					<div className="flex flex-col items-end min-w-0 max-w-[80%]">
						<div className="flex items-center gap-2 text-[10px] text-otto-muted pb-1.5 justify-end">
							<span className="font-medium text-emerald-600 dark:text-emerald-300">
								You
							</span>
							<span>·</span>
							<span>14:22</span>
						</div>
						<div className="inline-block text-xs text-otto-text leading-relaxed bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/30 dark:border-emerald-500/20 rounded-xl px-3 py-2">
							refactor the JWT middleware to use rotating keys
						</div>
					</div>
				</div>

				<div>
					<div className="pb-1.5">
						<div className="inline-flex items-center bg-violet-500/10 dark:bg-violet-500/5 border border-violet-500/30 dark:border-violet-500/20 rounded-full pr-3">
							<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-violet-500/40 dark:border-violet-500/50 bg-violet-500/15 dark:bg-violet-500/10">
								<svg
									className="h-3 w-3 text-violet-600 dark:text-violet-300"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
									<path d="M5 3v4" />
									<path d="M19 17v4" />
									<path d="M3 5h4" />
									<path d="M17 19h4" />
								</svg>
							</div>
							<div className="flex items-center gap-x-1.5 text-[10px] text-otto-muted pl-2">
								<span className="font-medium text-violet-600 dark:text-violet-300">
									build
								</span>
								<span className="text-otto-dim/50">·</span>
								<span>claude-sonnet-4</span>
							</div>
						</div>
					</div>

					<div className="relative ml-1">
						<div className="flex gap-2.5 pb-1.5 relative">
							<div className="flex-shrink-0 w-5 flex items-start justify-center relative pt-0.5">
								<div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full relative bg-otto-surface">
									<svg
										className="h-3 w-3 text-emerald-600 dark:text-emerald-300"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
										<path d="M14 2v4a2 2 0 0 0 2 2h4" />
										<path d="M3 15h6" />
										<path d="M6 12v6" />
									</svg>
								</div>
								<div
									className="absolute left-1/2 -translate-x-1/2 w-[2px] bg-otto-border"
									style={{ top: '1rem', bottom: '-0.25rem' }}
								/>
							</div>
							<div className="flex-1 min-w-0 pt-0.5">
								<div className="flex items-center gap-2 text-[10px]">
									<span className="text-emerald-600 dark:text-emerald-300 font-medium">
										write
									</span>
									<span className="text-otto-dim">
										src/middleware/jwt.ts — 48 lines
									</span>
								</div>
							</div>
						</div>

						<div className="flex gap-2.5 relative">
							<div className="flex-shrink-0 w-5 flex items-start justify-center relative pt-0.5">
								<div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full relative bg-otto-surface">
									<svg
										className="h-3 w-3 text-emerald-600 dark:text-emerald-300"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M20 6 9 17l-5-5" />
									</svg>
								</div>
							</div>
							<div className="flex-1 min-w-0 pt-0 -mt-0.5">
								<div className="text-xs text-otto-text leading-relaxed">
									Refactored JWT middleware to support rotating keys with{' '}
									<code className="text-[10px] bg-otto-card border border-otto-border rounded px-1 py-0.5 text-otto-text">
										jwks-rsa
									</code>
									.
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="px-4 pb-3 pt-2">
				<div className="relative flex flex-col rounded-3xl p-1 bg-otto-card border border-otto-border">
					<div className="flex items-end gap-1">
						<div className="flex-1 px-3 py-2 text-xs leading-normal min-h-[32px]">
							{typed ? (
								<span className="text-otto-text">
									{typed}
									<span className="animate-blink text-otto-dim">|</span>
								</span>
							) : (
								<span className="text-otto-dim">Type a message...</span>
							)}
						</div>
						<button
							type="button"
							className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 transition-colors ${
								phase === 'typing'
									? 'bg-otto-text text-otto-bg'
									: 'bg-transparent text-otto-dim'
							}`}
						>
							<svg
								className="w-3.5 h-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="m5 12 7-7 7 7" />
								<path d="M12 19V5" />
							</svg>
						</button>
					</div>
				</div>
			</div>

			{(phase === 'loading' || phase === 'toast') && (
				<div className="absolute bottom-16 right-4 flex flex-col gap-1.5 max-w-[220px] animate-fade-in">
					{phase === 'loading' && (
						<div className="flex items-center gap-2.5 px-3 py-2.5 bg-otto-card border border-otto-border rounded-lg shadow-lg">
							<svg
								className="h-3.5 w-3.5 text-otto-muted animate-spin flex-shrink-0"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M21 12a9 9 0 1 1-6.219-8.56" />
							</svg>
							<span className="text-[11px] text-otto-text">
								Sharing session...
							</span>
						</div>
					)}
					{phase === 'toast' && (
						<div className="flex items-center gap-2.5 px-3 py-2.5 bg-otto-card border border-otto-border rounded-lg shadow-lg animate-fade-in">
							<svg
								className="h-3.5 w-3.5 text-green-500 flex-shrink-0"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
								<path d="m9 11 3 3L22 4" />
							</svg>
							<span className="text-[11px] text-otto-text">
								Session shared!
							</span>
							<a
								href="https://share.ottocode.io/s/cjqwnr6mPsPIUAjG79daV"
								target="_blank"
								rel="noopener noreferrer"
								className="ml-auto flex items-center gap-0.5 text-[10px] text-otto-accent hover:underline flex-shrink-0"
							>
								Open
								<svg
									className="h-2.5 w-2.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M15 3h6v6" />
									<path d="M10 14 21 3" />
									<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
								</svg>
							</a>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export function ShareSection() {
	return (
		<section
			id="share"
			className="py-28 sm:py-36 px-6 border-t border-otto-border"
		>
			<div className="max-w-[900px] mx-auto">
				<Reveal>
					<p className="text-otto-dim text-xs uppercase tracking-[0.2em] mb-4">
						Share
					</p>
					<h2 className="text-2xl sm:text-3xl font-bold mb-3">
						Share sessions publicly
					</h2>
					<p className="text-otto-muted text-sm mb-12 max-w-lg">
						Turn any coding session into a shareable link. Show your workflow,
						share debugging journeys, or build a portfolio of AI-assisted
						development.
					</p>
				</Reveal>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
					<Reveal delay={60}>
						<ShareMockup />
					</Reveal>

					<Reveal delay={120}>
						<div className="space-y-6">
							<div>
								<h3 className="text-sm font-semibold text-otto-text mb-1">
									Create
								</h3>
								<p className="text-otto-muted text-sm">
									Type{' '}
									<code className="text-xs bg-otto-surface px-1.5 py-0.5 rounded">
										/share
									</code>{' '}
									in any session. Messages, tool calls, and code diffs are all
									preserved in the shared view.
								</p>
							</div>
							<div>
								<h3 className="text-sm font-semibold text-otto-text mb-1">
									Update
								</h3>
								<p className="text-otto-muted text-sm">
									Keep sharing as you work. Sync new messages to an existing
									share with{' '}
									<code className="text-xs bg-otto-surface px-1.5 py-0.5 rounded">
										/sync
									</code>
									.
								</p>
							</div>
							<div>
								<h3 className="text-sm font-semibold text-otto-text mb-1">
									Control
								</h3>
								<p className="text-otto-muted text-sm">
									One click to share, one click to open. Public links are
									read-only and can be deleted at any time.
								</p>
							</div>
						</div>
					</Reveal>
				</div>

				<Reveal delay={180}>
					<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-6 bg-otto-surface border border-otto-border rounded-lg">
						<div className="flex-1">
							<h3 className="text-sm font-semibold text-otto-text mb-1">
								See it in action
							</h3>
							<p className="text-otto-muted text-xs">
								Browse a real shared session to see how conversations, tool
								usage, and code changes render.
							</p>
						</div>
						<a
							href="https://share.ottocode.io/s/cjqwnr6mPsPIUAjG79daV"
							target="_blank"
							rel="noopener noreferrer"
							className="shrink-0 px-5 py-2.5 text-sm font-medium bg-otto-text text-otto-bg rounded-sm hover:opacity-90 transition-opacity"
						>
							View example session →
						</a>
					</div>
				</Reveal>
			</div>
		</section>
	);
}
