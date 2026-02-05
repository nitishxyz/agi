import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { OttoWordmark } from "../components/OttoWordmark";
import { ProviderLogo } from "../components/ProviderLogo";
import { useLatestRelease } from "../hooks/useLatestRelease";
import { CopyButton } from "../components/CopyButton";

function useInView(threshold = 0.1) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const obs = new IntersectionObserver(
			([e]) => { if (e.isIntersecting) setVisible(true); },
			{ threshold },
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, [threshold]);
	return { ref, visible };
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
	const { ref, visible } = useInView();
	return (
		<div
			ref={ref}
			className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}
			style={{ transitionDelay: `${delay}ms` }}
		>
			{children}
		</div>
	);
}

function TerminalBlock({ children, title, copyText }: { children: React.ReactNode; title?: string; copyText?: string }) {
	return (
		<div className="relative bg-otto-surface border border-otto-border rounded-lg overflow-hidden group/term">
			<div className="flex items-center gap-2 px-4 py-2.5 border-b border-otto-border relative">
				<div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
				<div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
				<div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
				{title && <span className="ml-1.5 text-otto-dim text-[11px]">{title}</span>}
				{copyText && <CopyButton text={copyText} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/term:opacity-100" />}
			</div>
			<div className="p-4 text-[13px] leading-relaxed font-mono">{children}</div>
		</div>
	);
}

function ProductMockup() {
	const [step, setStep] = useState(0);
	const maxSteps = 7;

	useEffect(() => {
		const t = setInterval(() => setStep((s) => (s < maxSteps ? s + 1 : s)), 600);
		return () => clearInterval(t);
	}, []);

	return (
		<div className="bg-otto-surface border border-otto-border rounded-lg overflow-hidden shadow-2xl shadow-black/10 dark:shadow-black/50">
			{/* LeanHeader */}
			<div className="h-14 border-b border-otto-border bg-otto-surface/95 flex items-center justify-between px-6">
				<div className="flex items-center gap-2 text-sm text-otto-muted">
					<svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
					<span className="text-otto-text font-medium truncate">Fix null check in login.ts</span>
				</div>
				<div className="flex-shrink-0 flex items-center gap-5 text-sm text-otto-muted">
					<div className="flex items-center gap-1">
						<span className="text-xs opacity-70">ctx</span>
						<span className="font-medium text-otto-text">12.4K</span>
					</div>
					<div className="flex items-center gap-1.5">
						<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
						<span className="font-medium text-otto-text">0.0032</span>
					</div>
					<div className="hidden sm:flex items-center gap-2">
						<ProviderLogo provider="anthropic" size={16} className="text-[#cc785c]" />
						<span className="font-medium text-otto-text truncate max-w-40">claude-sonnet-4</span>
					</div>
				</div>
			</div>

			{/* Message thread */}
			<div className="px-6 py-5 space-y-8 min-h-[340px] sm:min-h-[380px]">
				{step >= 1 && (
					<div className="flex justify-end animate-fade-in">
						<div className="flex flex-col items-end min-w-0 max-w-md">
							<div className="flex items-center gap-2 text-xs text-otto-muted pb-2 justify-end">
								<span className="font-medium text-emerald-600 dark:text-emerald-300">You</span>
								<span>·</span>
								<span>12:34</span>
							</div>
							<div className="inline-block text-sm text-otto-text leading-relaxed bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/30 dark:border-emerald-500/20 rounded-xl px-4 py-3">
								fix the null check in login.ts
							</div>
						</div>
					</div>
				)}

				{step >= 2 && (
					<div className="animate-fade-in">
						<div className="pb-2">
							<div className="inline-flex items-center bg-violet-500/10 dark:bg-violet-500/5 border border-violet-500/30 dark:border-violet-500/20 rounded-full pr-3 md:pr-4">
								<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-500/40 dark:border-violet-500/50 bg-violet-500/15 dark:bg-violet-500/10">
									<svg className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>
								</div>
								<div className="flex items-center gap-x-2 text-xs text-otto-muted pl-2 md:pl-3">
									<span className="font-medium text-violet-600 dark:text-violet-300">build</span>
									<span className="text-otto-dim/50">·</span>
									<span>claude-sonnet-4</span>
								</div>
							</div>
						</div>

						<div className="relative ml-1">
							{step >= 3 && (
								<div className="flex gap-3 pb-2 relative animate-fade-in">
									<div className="flex-shrink-0 w-6 flex flex-col items-center relative pt-0.5">
										<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-otto-surface">
											<svg className="h-4 w-4 text-blue-600 dark:text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>
										</div>
										<div className="w-px flex-1 bg-otto-border" />
									</div>
									<div className="flex-1 min-w-0 pt-1">
										<div className="flex items-center gap-2 text-xs">
											<span className="text-blue-600 dark:text-blue-300 font-medium">read</span>
											<span className="text-otto-dim">login.ts</span>
										</div>
									</div>
								</div>
							)}

							{step >= 4 && (
								<div className="flex gap-3 pb-2 relative animate-fade-in">
									<div className="flex-shrink-0 w-6 flex flex-col items-center relative pt-0.5">
										<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-otto-surface">
											<svg className="h-4 w-4 text-amber-600 dark:text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
										</div>
										<div className="w-px flex-1 bg-otto-border" />
									</div>
									<div className="flex-1 min-w-0 pt-1">
										<div className="flex items-center gap-2 text-xs">
											<span className="text-amber-600 dark:text-amber-300 font-medium">ripgrep</span>
											<span className="text-otto-dim">session?.token — 3 results</span>
										</div>
									</div>
								</div>
							)}

							{step >= 5 && (
								<div className="flex gap-3 pb-2 relative animate-fade-in">
									<div className="flex-shrink-0 w-6 flex flex-col items-center relative pt-0.5">
										<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-otto-surface">
											<svg className="h-4 w-4 text-purple-600 dark:text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v14" /><path d="M5 10h14" /><path d="M5 21h14" /></svg>
										</div>
										<div className="w-px flex-1 bg-otto-border" />
									</div>
									<div className="flex-1 min-w-0 pt-1">
										<div className="flex items-center gap-2 text-xs">
											<span className="text-purple-600 dark:text-purple-300 font-medium">apply_patch</span>
											<span className="text-otto-dim">login.ts — 3 lines changed</span>
										</div>
									</div>
								</div>
							)}

							{step >= 6 && (
								<div className="flex gap-3 pb-2 relative animate-fade-in">
									<div className="flex-shrink-0 w-6 flex flex-col items-center relative pt-0.5">
										<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-otto-surface">
											<svg className="h-4 w-4 text-otto-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
										</div>
										<div className="w-px flex-1 bg-otto-border" />
									</div>
									<div className="flex-1 min-w-0 pt-1">
										<div className="flex items-center gap-2 text-xs">
											<span className="text-otto-muted font-medium">bash</span>
											<span className="text-otto-dim">bun test — 14 passed</span>
										</div>
									</div>
								</div>
							)}

							{step >= 7 && (
								<div className="flex gap-3 relative animate-fade-in">
									<div className="flex-shrink-0 w-6 flex flex-col items-center relative pt-0.5">
										<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-otto-surface">
											<svg className="h-4 w-4 text-emerald-600 dark:text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
										</div>
									</div>
									<div className="flex-1 min-w-0 pt-0 -mt-0.5">
										<div className="text-sm text-otto-text leading-relaxed markdown-content">
											Added optional chaining on <code className="text-xs bg-otto-card border border-otto-border rounded px-1.5 py-0.5 text-otto-text">session?.token</code> at line 42. The null check was missing — accessing <code className="text-xs bg-otto-card border border-otto-border rounded px-1.5 py-0.5 text-otto-text">token</code> on a possibly undefined session caused runtime crashes during OAuth redirect.
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Chat input — matches real ChatInput.tsx */}
			<div className="px-4 pb-4 pt-2">
				<div className="relative flex flex-col rounded-3xl p-1 bg-otto-card border border-otto-border">
					<div className="flex items-end gap-1">
						<div className="flex-1 px-4 py-2.5 text-sm text-otto-dim leading-normal">
							Type a message...
						</div>
						<button
							type="button"
							className="flex items-center justify-center w-10 h-10 rounded-full bg-transparent text-otto-dim flex-shrink-0"
						>
							<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg>
						</button>
					</div>
				</div>
				<div className="flex items-center justify-center mt-1 px-3">
					<div className="text-[10px] text-otto-dim flex items-center gap-1">
						<ProviderLogo provider="anthropic" size={12} className="text-[#cc785c] opacity-70" />
						<span className="opacity-40">/</span>
						<span>claude-sonnet-4</span>
					</div>
				</div>
			</div>
		</div>
	);
}

function formatSize(bytes: number) {
	return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function DesktopDownloads() {
	const { release } = useLatestRelease();

	return (
		<Reveal delay={80}>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-otto-border rounded-lg overflow-hidden">
				{/* macOS */}
				<div className="bg-otto-bg p-6 sm:p-8">
					<div className="flex items-center gap-3 mb-4">
						<svg className="w-6 h-6 text-otto-text" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
						<div>
							<h3 className="text-lg font-semibold text-otto-text">macOS</h3>
							<p className="text-xs text-otto-dim">v{release.version}</p>
						</div>
					</div>
					<div className="space-y-2">
						{release.macosArm && (
							<a
								href={release.macosArm.url}
								className="flex items-center justify-between px-4 py-3 bg-otto-surface border border-otto-border rounded-sm hover:bg-otto-text hover:text-otto-bg hover:border-otto-text transition-all group"
							>
								<div className="flex items-center gap-3">
									<svg className="w-4 h-4 text-otto-dim group-hover:text-otto-bg transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
									<div>
										<span className="text-sm text-otto-text group-hover:text-otto-bg font-medium">Apple Silicon</span>
										<span className="text-xs text-otto-dim group-hover:text-otto-bg ml-2">.dmg</span>
									</div>
								</div>
								<span className="text-xs text-otto-dim group-hover:text-otto-bg">{formatSize(release.macosArm.size)}</span>
							</a>
						)}
						{release.macosIntel && (
							<a
								href={release.macosIntel.url}
								className="flex items-center justify-between px-4 py-3 bg-otto-surface border border-otto-border rounded-sm hover:bg-otto-text hover:text-otto-bg hover:border-otto-text transition-all group"
							>
								<div className="flex items-center gap-3">
									<svg className="w-4 h-4 text-otto-dim group-hover:text-otto-bg transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
									<div>
										<span className="text-sm text-otto-text group-hover:text-otto-bg font-medium">Intel</span>
										<span className="text-xs text-otto-dim group-hover:text-otto-bg ml-2">.dmg</span>
									</div>
								</div>
								<span className="text-xs text-otto-dim group-hover:text-otto-bg">{formatSize(release.macosIntel.size)}</span>
							</a>
						)}
					</div>
				</div>

				{/* Linux */}
				<div className="bg-otto-bg p-6 sm:p-8">
					<div className="flex items-center gap-3 mb-4">
						<svg className="w-6 h-6 text-otto-text" viewBox="0 0 24 24" fill="currentColor"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 0 0-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.368 1.884 1.368.39 0 .739-.134 1.107-.534.117.109.272.186.398.186.553 0 1.109-1.107 1.171-2.174.066-1.146-.142-2.074-.142-2.074s.476-.528.945-1.251c.453-.697.838-1.544.838-2.449 0-.543-.16-.723-.16-1.063 0-.34.199-.795.199-1.458 0-1.076-.535-1.746-1.292-2.478-.8-.8-1.851-1.293-2.334-2.259-.37-.72-.533-1.905-.672-3.019C16.031 1.995 15.068 0 12.504 0z" /></svg>
						<div>
							<h3 className="text-lg font-semibold text-otto-text">Linux</h3>
							<p className="text-xs text-otto-dim">v{release.version}</p>
						</div>
					</div>
					<div className="space-y-2">
						{release.linuxAppImage && (
							<a
								href={release.linuxAppImage.url}
								className="flex items-center justify-between px-4 py-3 bg-otto-surface border border-otto-border rounded-sm hover:bg-otto-text hover:text-otto-bg hover:border-otto-text transition-all group"
							>
								<div className="flex items-center gap-3">
									<svg className="w-4 h-4 text-otto-dim group-hover:text-otto-bg transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
									<div>
										<span className="text-sm text-otto-text group-hover:text-otto-bg font-medium">x86_64</span>
										<span className="text-xs text-otto-dim group-hover:text-otto-bg ml-2">.AppImage</span>
									</div>
								</div>
								<span className="text-xs text-otto-dim group-hover:text-otto-bg">{formatSize(release.linuxAppImage.size)}</span>
							</a>
						)}
					</div>
					<p className="text-[10px] text-otto-dim mt-3">chmod +x and run. No installation required.</p>
				</div>
			</div>

			<div className="flex items-center justify-between mt-4 px-1">
				<a
					href={`https://github.com/nitishxyz/otto/releases/tag/${release.tag}`}
					target="_blank"
					rel="noopener noreferrer"
					className="text-xs text-otto-dim hover:text-otto-muted transition-colors"
				>
					Release notes →
				</a>
				<a
					href="https://github.com/nitishxyz/otto/releases"
					target="_blank"
					rel="noopener noreferrer"
					className="text-xs text-otto-dim hover:text-otto-muted transition-colors"
				>
					All releases →
				</a>
			</div>
		</Reveal>
	);
}

export function Landing() {
	return (
		<main className="overflow-hidden">
			{/* ───── HERO ───── */}
			<section className="relative min-h-[100dvh] flex flex-col items-center justify-center px-6 pt-20 pb-16">
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.06),transparent)]" />

				<div className="relative z-10 w-full max-w-3xl mx-auto">
					<Reveal>
						<div className="text-center mb-10 sm:mb-12">
						<OttoWordmark height={40} className="text-otto-text mx-auto mb-8" />
						<p className="text-otto-muted text-sm sm:text-base max-w-md mx-auto mb-8">
							Open-source AI coding assistant.
					</p>
			<div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
					<a
						href="#desktop"
						className="px-5 py-2.5 bg-otto-text text-otto-bg text-sm font-medium rounded-sm hover:opacity-80 transition-colors flex items-center gap-2"
					>
						<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
						Desktop App
					</a>
								<Link
									to="/docs"
									className="px-5 py-2.5 border border-otto-border text-otto-muted text-sm rounded-sm hover:border-otto-border-light hover:text-otto-text transition-colors"
								>
									Docs
								</Link>
							</div>
						</div>
					</Reveal>

					<Reveal delay={200}>
						<ProductMockup />
					</Reveal>
				</div>
			</section>

			{/* ───── INTERFACES ───── */}
			<section className="py-28 sm:py-36 px-6">
				<div className="max-w-[1100px] mx-auto">
					<Reveal>
						<p className="text-otto-dim text-xs uppercase tracking-[0.2em] mb-4">Interfaces</p>
						<h2 className="text-2xl sm:text-3xl font-bold mb-16 max-w-md">
							One tool.<br />Every surface.
						</h2>
					</Reveal>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-otto-border rounded-lg overflow-hidden">
						{[
							{
								tag: "CLI",
								headline: "Terminal-native",
								body: "One-shot prompts or interactive sessions. Compiles to a single self-contained binary.",
								cmd: "otto ask \"fix the auth bug\"",
							},
							{
								tag: "Server",
								headline: "HTTP API + Web UI",
								body: "Local Hono server with SSE streaming. React web interface with session management.",
								cmd: "otto serve --port 3000",
							},
							{
								tag: "Desktop",
								headline: "Native app",
								body: "Tauri v2 app that embeds the CLI binary and web UI. macOS, Linux, Windows.",
								cmd: "otto",
							},
							{
								tag: "SDK",
								headline: "Embed anywhere",
								body: "Use @ottocode/server in your own apps. Provider-agnostic. Tree-shakable.",
								cmd: "import { createEmbeddedApp }",
							},
						].map((item, i) => (
							<Reveal key={item.tag} delay={i * 80}>
								<div className="bg-otto-bg p-7 sm:p-8 h-full">
									<span className="text-[11px] text-otto-dim uppercase tracking-wider">{item.tag}</span>
									<h3 className="text-lg font-semibold mt-2 mb-2">{item.headline}</h3>
									<p className="text-otto-muted text-sm leading-relaxed mb-5">{item.body}</p>
									<code className="text-xs text-otto-dim bg-otto-surface px-3 py-1.5 rounded border border-otto-border inline-block">
										{item.cmd}
									</code>
								</div>
							</Reveal>
						))}
					</div>
				</div>
			</section>

			{/* ───── CODE EXAMPLE ───── */}
			<section className="py-28 sm:py-36 px-6 border-t border-otto-border">
				<div className="max-w-[900px] mx-auto">
					<Reveal>
						<p className="text-otto-dim text-xs uppercase tracking-[0.2em] mb-4">Embedding</p>
						<h2 className="text-2xl sm:text-3xl font-bold mb-4 max-w-sm">
							Embed in minutes
						</h2>
						<p className="text-otto-muted text-sm mb-10 max-w-md">
							Full SDK with provider switching, tool execution, and streaming.
						</p>
					</Reveal>

					<Reveal delay={100}>
						<TerminalBlock title="server.ts" copyText={'import { createEmbeddedApp } from "@ottocode/server";\n\nconst app = createEmbeddedApp({\n  provider: "anthropic",\n  model: "claude-sonnet-4",\n  apiKey: process.env.ANTHROPIC_API_KEY,\n  agent: "build",\n});'}>
							<span className="text-purple-700 dark:text-purple-400">import</span>
							<span className="text-otto-text"> {"{ createEmbeddedApp }"} </span>
							<span className="text-purple-700 dark:text-purple-400">from</span>
							<span className="text-green-700 dark:text-green-400"> "@ottocode/server"</span>
							<span className="text-otto-dim">;</span>
							<br /><br />
							<span className="text-purple-700 dark:text-purple-400">const</span>
							<span className="text-blue-700 dark:text-blue-400"> app </span>
							<span className="text-otto-text">= </span>
							<span className="text-yellow-700 dark:text-yellow-300">createEmbeddedApp</span>
							<span className="text-otto-text">({"{"}</span>
							<br />
							<span className="text-otto-text">{"  "}provider: </span>
							<span className="text-green-700 dark:text-green-400">"anthropic"</span>
							<span className="text-otto-dim">,</span>
							<br />
							<span className="text-otto-text">{"  "}model: </span>
							<span className="text-green-700 dark:text-green-400">"claude-sonnet-4"</span>
							<span className="text-otto-dim">,</span>
							<br />
							<span className="text-otto-text">{"  "}apiKey: process.env.</span>
							<span className="text-blue-700 dark:text-blue-400">ANTHROPIC_API_KEY</span>
							<span className="text-otto-dim">,</span>
							<br />
							<span className="text-otto-text">{"  "}agent: </span>
							<span className="text-green-700 dark:text-green-400">"build"</span>
							<span className="text-otto-dim">,</span>
							<br />
							<span className="text-otto-text">{"}"});</span>
						</TerminalBlock>
					</Reveal>
				</div>
			</section>

			{/* ───── AGENTS ───── */}
			<section className="py-28 sm:py-36 px-6 border-t border-otto-border">
				<div className="max-w-[1100px] mx-auto">
					<Reveal>
						<p className="text-otto-dim text-xs uppercase tracking-[0.2em] mb-4">Agents</p>
						<h2 className="text-2xl sm:text-3xl font-bold mb-16 max-w-sm">
							Purpose-built agents
						</h2>
					</Reveal>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{[
							{ name: "build", color: "text-green-700 dark:text-green-400", desc: "Code generation, bug fixes, features. Full filesystem + shell access.", tools: ["read", "write", "bash", "git", "terminal", "apply_patch"] },
							{ name: "plan", color: "text-blue-700 dark:text-blue-400", desc: "Architecture planning and analysis. Read-only — cannot modify files.", tools: ["read", "ls", "tree", "ripgrep", "websearch"] },
							{ name: "general", color: "text-yellow-400", desc: "General-purpose assistant. Balanced toolset for everyday work.", tools: ["read", "write", "bash", "ripgrep", "glob"] },
							{ name: "research", color: "text-purple-700 dark:text-purple-400", desc: "Deep research across sessions and the web. Queries past context.", tools: ["read", "ripgrep", "websearch", "query_sessions"] },
						].map((a, i) => (
							<Reveal key={a.name} delay={i * 60}>
								<div className="bg-otto-surface border border-otto-border rounded-lg p-6">
									<div className="flex items-center gap-2.5 mb-3">
										<span className={`text-sm font-bold ${a.color}`}>{a.name}</span>
										<span className="text-otto-dim text-[10px] uppercase tracking-wider">agent</span>
									</div>
									<p className="text-otto-muted text-sm leading-relaxed mb-4">{a.desc}</p>
									<div className="flex flex-wrap gap-1.5">
										{a.tools.map((t) => (
											<span key={t} className="px-2 py-0.5 text-[10px] bg-otto-bg border border-otto-border rounded text-otto-dim">{t}</span>
										))}
									</div>
								</div>
							</Reveal>
						))}
					</div>
				</div>
			</section>

			{/* ───── PROVIDERS ───── */}
			<section className="py-28 sm:py-36 px-6 border-t border-otto-border">
				<div className="max-w-[1100px] mx-auto">
					<Reveal>
						<p className="text-otto-dim text-xs uppercase tracking-[0.2em] mb-4">Providers</p>
						<h2 className="text-2xl sm:text-3xl font-bold mb-16 max-w-sm">
							Every frontier model
						</h2>
					</Reveal>

					<div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-otto-border rounded-lg overflow-hidden">
					{[
						{ id: "anthropic", name: "Anthropic", models: "Claude 4.5 Sonnet, Opus", auth: ["API key", "Pro/Max (OAuth)"] },
						{ id: "openai", name: "OpenAI", models: "GPT-4o, o1, Codex Mini", auth: ["API key", "Pro/Max (OAuth)"] },
						{ id: "google", name: "Google", models: "Gemini 2.5 Pro, Flash", auth: ["API key"] },
						{ id: "openrouter", name: "OpenRouter", models: "100+ models", auth: ["API key"] },
						{ id: "opencode", name: "OpenCode", models: "Anthropic & OpenAI models", auth: ["API key"] },
						{ id: "copilot", name: "Copilot", models: "GitHub Copilot models", auth: ["OAuth"] },
						{ id: "setu", name: "Setu", models: "USDC pay-per-use proxy", auth: ["Solana wallet"] },
						{ id: "zai", name: "Zai", models: "Zai frontier models", auth: ["API key"] },
						{ id: "moonshot", name: "Moonshot", models: "Kimi models", auth: ["API key"] },
					].map((p, i) => (
							<Reveal key={p.id} delay={i * 40}>
								<div className="bg-otto-bg p-5 sm:p-6 h-full">
									<div className="flex items-center gap-2.5 mb-2">
										<ProviderLogo provider={p.id} size={18} className="text-otto-text" />
										<span className="text-sm font-medium">{p.name}</span>
									</div>
							<p className="text-otto-dim text-xs mb-3">{p.models}</p>
							<div className="flex flex-wrap gap-1.5">
								{p.auth.map((a) => (
									<span key={a} className="text-[10px] text-otto-dim bg-otto-surface px-2 py-0.5 rounded border border-otto-border">{a}</span>
								))}
							</div>
						</div>
							</Reveal>
						))}
					</div>
				</div>
			</section>

			{/* ───── TOOLS ───── */}
			<section className="py-28 sm:py-36 px-6 border-t border-otto-border">
				<div className="max-w-[1100px] mx-auto">
					<Reveal>
						<p className="text-otto-dim text-xs uppercase tracking-[0.2em] mb-4">Tools</p>
						<h2 className="text-2xl sm:text-3xl font-bold mb-16 max-w-sm">
							15+ built-in tools
						</h2>
					</Reveal>

					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
						{[
							{ cat: "File", items: ["read", "write", "ls", "tree", "glob"] },
							{ cat: "Search", items: ["grep", "ripgrep", "websearch"] },
							{ cat: "Edit", items: ["edit", "apply_patch"] },
							{ cat: "Shell", items: ["bash", "terminal"] },
							{ cat: "Git", items: ["git_status", "git_diff", "git_commit"] },
							{ cat: "Agent", items: ["progress_update", "finish", "update_todos"] },
						].map((g, i) => (
							<Reveal key={g.cat} delay={i * 40}>
								<div>
									<span className="text-[10px] text-otto-dim uppercase tracking-wider">{g.cat}</span>
									<div className="mt-2 space-y-1">
										{g.items.map((t) => (
											<div key={t} className="text-sm text-otto-muted">{t}</div>
										))}
									</div>
								</div>
							</Reveal>
						))}
					</div>
				</div>
			</section>

			{/* ───── ARCHITECTURE ───── */}
			<section className="py-28 sm:py-36 px-6 border-t border-otto-border">
				<div className="max-w-[900px] mx-auto">
					<Reveal>
						<p className="text-otto-dim text-xs uppercase tracking-[0.2em] mb-4">Architecture</p>
						<h2 className="text-2xl sm:text-3xl font-bold mb-4 max-w-sm">
							Clean layers
						</h2>
						<p className="text-otto-muted text-sm mb-10 max-w-md">
							Bun workspace monorepo. 6 apps, 7 packages. SST infrastructure.
						</p>
					</Reveal>

					<Reveal delay={100}>
						<TerminalBlock title="dependency graph" copyText="L0  install — zero deps
L1  sdk — auth, config, providers, tools
L2  database → sdk
L3  server → sdk, database
L4  web-sdk → api, sdk
L5  cli → sdk, server, database">
							<div className="space-y-0.5">
								<div><span className="text-otto-dim">L0</span><span className="text-otto-muted">  install, api, web-ui</span></div>
								<div><span className="text-otto-dim">L1</span><span className="text-blue-700 dark:text-blue-400">  sdk</span><span className="text-otto-dim"> — auth, config, providers, tools</span></div>
								<div><span className="text-otto-dim">L2</span><span className="text-green-700 dark:text-green-400">  database</span><span className="text-otto-dim"> → sdk</span></div>
								<div><span className="text-otto-dim">L3</span><span className="text-yellow-400">  server</span><span className="text-otto-dim"> → sdk, database</span></div>
								<div><span className="text-otto-dim">L4</span><span className="text-purple-700 dark:text-purple-400">  web-sdk</span><span className="text-otto-dim"> → api, sdk</span></div>
								<div><span className="text-otto-dim">L5</span><span className="text-red-700 dark:text-red-400">  cli</span><span className="text-otto-dim"> → sdk, server, database</span></div>
							</div>
						</TerminalBlock>
					</Reveal>
				</div>
			</section>

			{/* ───── TECH ───── */}
			<section className="py-28 sm:py-36 px-6 border-t border-otto-border">
				<div className="max-w-[1100px] mx-auto">
					<Reveal>
						<p className="text-otto-dim text-xs uppercase tracking-[0.2em] mb-4">Stack</p>
						<h2 className="text-2xl sm:text-3xl font-bold mb-12">Built with</h2>
					</Reveal>

					<Reveal delay={80}>
						<div className="flex flex-wrap gap-2">
							{[
								"Bun", "TypeScript", "AI SDK", "Hono", "SQLite",
								"Drizzle", "React", "Vite", "TanStack", "Tailwind",
								"Tauri v2", "SST", "Biome",
							].map((t) => (
								<span key={t} className="px-3 py-1.5 text-xs text-otto-muted bg-otto-surface border border-otto-border rounded">
									{t}
								</span>
							))}
						</div>
					</Reveal>
				</div>
			</section>

			{/* ───── INSTALL CTA ───── */}
			{/* ───── DESKTOP APP ───── */}
			<section id="desktop" className="py-28 sm:py-36 px-6 border-t border-otto-border">
				<div className="max-w-[900px] mx-auto">
					<Reveal>
						<p className="text-otto-dim text-xs uppercase tracking-[0.2em] mb-4">Desktop App</p>
						<h2 className="text-2xl sm:text-3xl font-bold mb-3">Native experience</h2>
						<p className="text-otto-muted text-sm mb-12 max-w-lg">
							Full-featured desktop app built with Tauri v2. Native performance, system tray, global shortcuts. Available for macOS and Linux.
						</p>
					</Reveal>

					<DesktopDownloads />
				</div>
			</section>

			{/* ───── INSTALL CTA ───── */}
			<section id="install" className="py-28 sm:py-36 px-6 border-t border-otto-border">
				<div className="max-w-[600px] mx-auto">
					<Reveal>
						<OttoWordmark height={28} className="text-otto-text mb-8" />
						<p className="text-otto-muted text-sm mb-10 max-w-sm">
							One command. Open source. MIT license.
						</p>
					</Reveal>

				<Reveal delay={80}>
					<TerminalBlock copyText="curl -fsSL https://install.ottocode.io | sh">
						<div><span className="text-otto-dim">$</span> curl -fsSL https://install.ottocode.io | sh</div>
					</TerminalBlock>
				</Reveal>

				<Reveal delay={120}>
					<p className="text-otto-dim text-xs mt-6 mb-4">or</p>
					<TerminalBlock copyText="bun install -g @ottocode/install">
						<div><span className="text-otto-dim">$</span> bun install -g @ottocode/install</div>
					</TerminalBlock>
					</Reveal>

			<Reveal delay={160}>
		<div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-10">
				<a
					href="#desktop"
					className="px-5 py-2.5 bg-otto-text text-otto-bg text-sm font-medium rounded-sm hover:opacity-80 transition-colors flex items-center gap-2"
				>
					<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
					Desktop App
				</a>
				<Link
					to="/docs"
					className="px-5 py-2.5 border border-otto-border text-otto-muted text-sm rounded-sm hover:border-otto-border-light hover:text-otto-text transition-colors"
				>
					Docs
				</Link>
							<a
								href="https://github.com/nitishxyz/otto"
								target="_blank"
								rel="noopener noreferrer"
								className="px-5 py-2.5 border border-otto-border text-otto-muted text-sm rounded-sm hover:border-otto-border-light hover:text-otto-text transition-colors"
							>
								GitHub
							</a>
						</div>
					</Reveal>
				</div>
			</section>
		</main>
	);
}
