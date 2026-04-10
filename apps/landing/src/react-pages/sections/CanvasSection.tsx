import { useEffect, useState } from 'react';
import { Reveal } from '../../components/Reveal';

const BLOCKS = [
	{
		label: 'Terminal',
		desc: 'Native GPU-rendered terminal powered by libghostty.',
		tech: 'Ghostty',
		color: 'text-emerald-500 dark:text-emerald-400',
		bg: 'bg-emerald-500/10',
		border: 'border-emerald-500/20',
	},
	{
		label: 'Browser',
		desc: 'Inline web preview for localhost or any URL via native WKWebView.',
		tech: 'WKWebView',
		color: 'text-blue-500 dark:text-blue-400',
		bg: 'bg-blue-500/10',
		border: 'border-blue-500/20',
	},
	{
		label: 'Otto',
		desc: 'AI chat with full tool access scoped to your project.',
		tech: 'otto serve',
		color: 'text-violet-500 dark:text-violet-400',
		bg: 'bg-violet-500/10',
		border: 'border-violet-500/20',
	},
	{
		label: 'Claude Code',
		desc: 'Launch Claude Code in a native Ghostty surface.',
		tech: 'Command preset',
		color: 'text-orange-500 dark:text-orange-400',
		bg: 'bg-orange-500/10',
		border: 'border-orange-500/20',
	},
	{
		label: 'Codex',
		desc: 'Launch OpenAI Codex inside a Ghostty-backed surface.',
		tech: 'Command preset',
		color: 'text-teal-500 dark:text-teal-400',
		bg: 'bg-teal-500/10',
		border: 'border-teal-500/20',
	},
	{
		label: 'Custom command',
		desc: 'Run any shell command in a terminal block.',
		tech: 'Ghostty',
		color: 'text-otto-muted',
		bg: 'bg-otto-surface',
		border: 'border-otto-border',
	},
];

const CAPABILITIES = [
	{
		title: 'Multi-workspace',
		desc: 'Each workspace is linked to a project path. Canvas auto-starts an otto serve runtime per workspace.',
		icon: (
			<svg
				className="w-5 h-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<rect width="7" height="7" x="3" y="3" rx="1" />
				<rect width="7" height="7" x="14" y="3" rx="1" />
				<rect width="7" height="7" x="14" y="14" rx="1" />
				<rect width="7" height="7" x="3" y="14" rx="1" />
			</svg>
		),
	},
	{
		title: 'Splits & tabs',
		desc: 'Horizontal and vertical splits within canvas tabs. Open any block type as a standalone tab.',
		icon: (
			<svg
				className="w-5 h-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<rect width="18" height="18" x="3" y="3" rx="2" />
				<line x1="12" x2="12" y1="3" y2="21" />
			</svg>
		),
	},
	{
		title: 'Keyboard-first',
		desc: '⌘N add block · ⌘T new tab · ⌘D split right · ⌘⇧D split down · ⌘1-9 switch tabs · Ctrl+HJKL vim navigation.',
		icon: (
			<svg
				className="w-5 h-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<rect width="20" height="16" x="2" y="4" rx="2" />
				<path d="M6 8h.001" />
				<path d="M10 8h.001" />
				<path d="M14 8h.001" />
				<path d="M18 8h.001" />
				<path d="M8 12h.001" />
				<path d="M12 12h.001" />
				<path d="M16 12h.001" />
				<path d="M7 16h10" />
			</svg>
		),
	},
	{
		title: 'Workspace file',
		desc: 'Export your layout, tabs, and automation as otto.yaml. Share identical surfaces with your team.',
		icon: (
			<svg
				className="w-5 h-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
				<path d="M14 2v4a2 2 0 0 0 2 2h4" />
				<path d="M2 15h10" />
				<path d="m9 18 3-3-3-3" />
			</svg>
		),
	},
	{
		title: 'Native performance',
		desc: 'Ghostty terminals with GPU rendering. WKWebView browser blocks. No Electron overhead.',
		icon: (
			<svg
				className="w-5 h-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="m13 2-2 2.5h3L12 7" />
				<path d="M10 14v-3" />
				<path d="M14 14v-3" />
				<path d="M11 19c-1.7 0-3-1.3-3-3v-2h8v2c0 1.7-1.3 3-3 3Z" />
				<path d="M12 22v-3" />
			</svg>
		),
	},
	{
		title: 'macOS vibrancy',
		desc: 'Transparent blur-backed window chrome via NSVisualEffectMaterial. Feels like part of the OS.',
		icon: (
			<svg
				className="w-5 h-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M12 3v14" />
				<path d="M5 10h14" />
				<path d="M5 21h14" />
			</svg>
		),
	},
];

function CanvasMockup() {
	const [step, setStep] = useState(0);
	const maxSteps = 4;

	useEffect(() => {
		const t = setInterval(
			() => setStep((s) => (s < maxSteps ? s + 1 : s)),
			700,
		);
		return () => clearInterval(t);
	}, []);

	return (
		<div className="bg-otto-surface border border-otto-border rounded-lg overflow-hidden shadow-2xl shadow-black/10 dark:shadow-black/50">
			<div className="h-11 border-b border-otto-border bg-otto-surface/95 flex items-center px-4 gap-3">
				<div className="flex items-center gap-1.5">
					<div className="w-3 h-3 rounded-full bg-red-500/80" />
					<div className="w-3 h-3 rounded-full bg-yellow-500/80" />
					<div className="w-3 h-3 rounded-full bg-green-500/80" />
				</div>
				<div className="flex-1 flex items-center justify-center">
					<span className="text-xs text-otto-dim font-medium">Otto Canvas</span>
				</div>
				<div className="w-[54px]" />
			</div>

			<div className="flex min-h-[320px] sm:min-h-[360px]">
				<div className="w-14 border-r border-otto-border bg-otto-bg/50 flex flex-col items-center pt-4 gap-2">
					{step >= 1 && (
						<div className="w-9 h-9 rounded-[10px] bg-violet-500/20 flex items-center justify-center text-[11px] font-bold text-violet-400 animate-fade-in">
							AG
						</div>
					)}
					{step >= 1 && (
						<div className="w-9 h-9 rounded-[10px] bg-emerald-500/20 flex items-center justify-center text-[11px] font-bold text-emerald-400 animate-fade-in">
							OT
						</div>
					)}
					{step >= 2 && (
						<div className="w-[20px] h-px bg-otto-border my-1 animate-fade-in" />
					)}
					{step >= 2 && (
						<div className="w-9 h-9 rounded-[10px] bg-otto-border/50 flex items-center justify-center text-otto-dim animate-fade-in">
							<svg
								className="w-4 h-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<line x1="12" x2="12" y1="5" y2="19" />
								<line x1="5" x2="19" y1="12" y2="12" />
							</svg>
						</div>
					)}
				</div>

				<div className="flex-1 flex flex-col">
					{step >= 1 && (
						<div className="flex items-center gap-2 h-8 px-3 border-b border-otto-border animate-fade-in">
							<span className="text-[11px] font-medium text-otto-text">
								agi
							</span>
							<span className="text-[10px] text-otto-dim truncate">
								/Users/dev/agi
							</span>
						</div>
					)}

					<div className="flex-1 flex">
						{step >= 2 && (
							<div className="flex-1 border-r border-otto-border flex flex-col animate-fade-in">
								<div className="h-7 border-b border-otto-border flex items-center px-3 gap-1.5">
									<svg
										className="w-3 h-3 text-emerald-400"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<polyline points="4 17 10 11 4 5" />
										<line x1="12" x2="20" y1="19" y2="19" />
									</svg>
									<span className="text-[10px] text-otto-dim">Terminal</span>
								</div>
								<div className="flex-1 bg-[rgb(6,7,8)] p-3 font-mono text-[11px] leading-[1.6] text-emerald-400/90">
									{step >= 3 && (
										<div className="animate-fade-in">
											<div className="text-otto-dim">~/agi $</div>
											<div>bun run dev</div>
											<div className="text-otto-dim mt-1">
												<span className="text-blue-400">ready</span> on :3000
											</div>
										</div>
									)}
								</div>
							</div>
						)}

						{step >= 3 && (
							<div className="flex-1 flex flex-col animate-fade-in">
								<div className="h-7 border-b border-otto-border flex items-center px-3 gap-1.5">
									<svg
										className="w-3 h-3 text-violet-400"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
									</svg>
									<span className="text-[10px] text-otto-dim">Otto</span>
								</div>
								<div className="flex-1 p-3 flex flex-col justify-between">
									{step >= 4 && (
										<div className="space-y-3 animate-fade-in">
											<div className="flex justify-end">
												<div className="text-[11px] text-otto-text bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 max-w-[85%]">
													add canvas section to the landing page
												</div>
											</div>
											<div className="flex items-center gap-2">
												<div className="w-6 h-6 rounded-full bg-violet-500/20 flex-shrink-0 flex items-center justify-center">
													<svg
														className="w-3.5 h-3.5 text-violet-400"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													>
														<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
													</svg>
												</div>
												<div className="text-[11px] text-otto-muted leading-relaxed">
													Reading sections and building the component...
													<span className="inline-block w-1 h-3 bg-otto-text/60 ml-0.5 animate-blink" />
												</div>
											</div>
										</div>
									)}
									<div className="mt-3 rounded-xl border border-otto-border bg-otto-card p-2">
										<div className="text-[11px] text-otto-dim px-2">
											Type a message...
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export function CanvasSection() {
	return (
		<section className="py-28 sm:py-36 px-6 border-t border-otto-border relative">
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(139,92,246,0.04),transparent)]" />

			<div className="max-w-[1100px] mx-auto relative z-10">
				<Reveal>
					<div className="flex items-center gap-3 mb-4">
						<span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-500 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full">
							Coming soon
						</span>
						<p className="text-otto-dim text-xs uppercase tracking-[0.2em]">
							Otto Canvas
						</p>
					</div>
					<h2 className="text-3xl sm:text-4xl font-bold mb-3 max-w-xl">
						Your entire dev workflow.
						<br />
						One native surface.
					</h2>
					<p className="text-otto-muted text-sm sm:text-base mb-12 max-w-xl leading-relaxed">
						Canvas is a native desktop app that gives you a persistent, tiled
						workspace for AI-powered development. Terminals, browsers, AI
						agents, and coding tools — all in composable blocks.
					</p>
				</Reveal>

				<Reveal delay={120}>
					<CanvasMockup />
				</Reveal>

				<div className="mt-16">
					<Reveal>
						<h3 className="text-lg font-semibold mb-6">Block types</h3>
					</Reveal>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-otto-border rounded-lg overflow-hidden">
						{BLOCKS.map((block, i) => (
							<Reveal key={block.label} delay={i * 60}>
								<div className="bg-otto-bg p-6 h-full">
									<div className="flex items-center gap-2 mb-2">
										<span className={`text-sm font-semibold ${block.color}`}>
											{block.label}
										</span>
										<span
											className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${block.bg} ${block.border} border ${block.color}`}
										>
											{block.tech}
										</span>
									</div>
									<p className="text-otto-muted text-sm leading-relaxed">
										{block.desc}
									</p>
								</div>
							</Reveal>
						))}
					</div>
				</div>

				<div className="mt-16">
					<Reveal>
						<h3 className="text-lg font-semibold mb-6">Core capabilities</h3>
					</Reveal>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-otto-border rounded-lg overflow-hidden">
						{CAPABILITIES.map((cap, i) => (
							<Reveal key={cap.title} delay={i * 60}>
								<div className="bg-otto-bg p-6 h-full">
									<div className="flex items-center gap-3 mb-3">
										<div className="text-otto-muted">{cap.icon}</div>
										<h4 className="text-sm font-semibold text-otto-text">
											{cap.title}
										</h4>
									</div>
									<p className="text-otto-muted text-sm leading-relaxed">
										{cap.desc}
									</p>
								</div>
							</Reveal>
						))}
					</div>
				</div>

				<Reveal delay={100}>
					<div className="mt-12 flex flex-wrap items-center gap-3">
						<a
							href="https://github.com/nitishxyz/otto/tree/main/apps/canvas"
							target="_blank"
							rel="noopener noreferrer"
							className="px-5 py-2.5 bg-otto-text text-otto-bg text-sm font-medium rounded-sm hover:opacity-80 transition-colors"
						>
							View on GitHub
						</a>
						<span className="text-otto-dim text-xs">
							Tauri v2 · React · Ghostty · libghostty · WKWebView
						</span>
					</div>
				</Reveal>
			</div>
		</section>
	);
}
