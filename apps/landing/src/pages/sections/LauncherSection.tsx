import { useEffect, useRef, useState } from 'react';
import { Reveal } from '../../components/Reveal';
import { useLatestLauncherRelease } from '../../hooks/useLatestLauncherRelease';

function formatSize(bytes: number) {
	return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function DownloadButton({
	href,
	label,
	ext,
	size,
}: {
	href: string;
	label: string;
	ext: string;
	size: number;
}) {
	return (
		<a
			href={href}
			className="flex items-center justify-between px-4 py-3 bg-otto-surface border border-otto-border rounded-sm hover:bg-otto-text hover:text-otto-bg hover:border-otto-text transition-all group"
		>
			<div className="flex items-center gap-3">
				<svg
					className="w-4 h-4 text-otto-dim group-hover:text-otto-bg transition-colors"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" x2="12" y1="15" y2="3" />
				</svg>
				<div>
					<span className="text-sm text-otto-text group-hover:text-otto-bg font-medium">
						{label}
					</span>
					<span className="text-xs text-otto-dim group-hover:text-otto-bg ml-2">
						{ext}
					</span>
				</div>
			</div>
			<span className="text-xs text-otto-dim group-hover:text-otto-bg">
				{formatSize(size)}
			</span>
		</a>
	);
}

const SETUP_STEPS = [
	{ label: 'Installing system packages', icon: 'package' },
	{ label: 'Setting up SSH', icon: 'key' },
	{ label: 'Configuring git', icon: 'git' },
	{ label: 'Cloning repo', icon: 'clone' },
	{ label: 'Installing dependencies', icon: 'deps' },
	{ label: 'Starting otto', icon: 'rocket' },
];

function LauncherMockup() {
	const containerRef = useRef<HTMLDivElement>(null);
	const [inView, setInView] = useState(false);
	const [step, setStep] = useState(-1);

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
		const timers: ReturnType<typeof setTimeout>[] = [];
		for (let i = 0; i <= SETUP_STEPS.length; i++) {
			timers.push(setTimeout(() => setStep(i), 600 + i * 800));
		}
		return () => timers.forEach(clearTimeout);
	}, [inView]);

	return (
		<div
			ref={containerRef}
			className="bg-otto-surface border border-otto-border rounded-xl overflow-hidden shadow-2xl shadow-black/10 dark:shadow-black/50"
		>
			<div className="h-11 border-b border-otto-border bg-otto-surface/95 flex items-center px-4">
				<div className="flex items-center gap-1.5 mr-4">
					<div className="w-2.5 h-2.5 rounded-full bg-otto-border" />
					<div className="w-2.5 h-2.5 rounded-full bg-otto-border" />
					<div className="w-2.5 h-2.5 rounded-full bg-otto-border" />
				</div>
				<span className="text-[10px] font-semibold tracking-wider text-otto-dim uppercase">
					otto launcher
				</span>
			</div>

			<div className="p-5">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<div
							className={`w-2 h-2 rounded-full transition-colors duration-500 ${step >= SETUP_STEPS.length ? 'bg-green-500' : step >= 0 ? 'bg-yellow-500 animate-pulse' : 'bg-otto-border'}`}
						/>
						<span className="text-xs font-medium text-otto-text">
							my-saas-app
						</span>
					</div>
					<span className="text-[10px] text-otto-dim font-mono">:9100</span>
				</div>

				<div className="space-y-1">
					{SETUP_STEPS.map((s, i) => (
						<div
							key={s.label}
							className={`flex items-center gap-2.5 py-1.5 transition-all duration-300 ${step >= i ? 'opacity-100' : 'opacity-30'}`}
						>
							<div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
								{step > i ? (
									<svg
										className="w-3.5 h-3.5 text-green-500"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="3"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M20 6 9 17l-5-5" />
									</svg>
								) : step === i ? (
									<svg
										className="w-3.5 h-3.5 text-otto-muted animate-spin"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2.5"
										strokeLinecap="round"
									>
										<path d="M21 12a9 9 0 1 1-6.219-8.56" />
									</svg>
								) : (
									<div className="w-1.5 h-1.5 rounded-full bg-otto-border" />
								)}
							</div>
							<span
								className={`text-xs ${step === i ? 'text-otto-text' : step > i ? 'text-otto-muted' : 'text-otto-dim'}`}
							>
								<span className="text-otto-dim font-mono mr-1.5">
									[{i + 1}/6]
								</span>
								{s.label}
								{step > i && (
									<span className="text-green-500/70 ml-1.5">Done</span>
								)}
							</span>
						</div>
					))}
				</div>

				{step >= SETUP_STEPS.length && (
					<div className="mt-4 pt-3 border-t border-otto-border animate-fade-in">
						<div className="flex items-center gap-2 text-xs text-green-500">
							<svg
								className="w-3.5 h-3.5"
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
							<span className="font-medium">Otto is ready!</span>
							<span className="text-otto-dim ml-auto text-[10px]">
								http://localhost:9100
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function LauncherDownloads() {
	const { release } = useLatestLauncherRelease();

	return (
		<Reveal delay={120}>
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-otto-border rounded-lg overflow-hidden -mx-8 sm:-mx-16">
				<div className="bg-otto-bg p-6 sm:p-8 space-y-3">
					<div className="flex items-center gap-3 mb-4">
						<svg
							className="w-6 h-6 text-otto-text"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
						</svg>
						<div>
							<h3 className="text-lg font-semibold text-otto-text">macOS</h3>
							<p className="text-[10px] text-otto-dim">v{release.version}</p>
						</div>
					</div>
					<div className="space-y-2">
						{release.macosArm && (
							<DownloadButton
								href={release.macosArm.url}
								label="Apple Silicon"
								ext=".dmg"
								size={release.macosArm.size}
							/>
						)}
						{release.macosIntel && (
							<DownloadButton
								href={release.macosIntel.url}
								label="Intel"
								ext=".dmg"
								size={release.macosIntel.size}
							/>
						)}
					</div>
				</div>

				<div className="bg-otto-bg p-6 sm:p-8 space-y-3">
					<div className="flex items-center gap-3 mb-4">
						<svg
							className="w-6 h-6 text-otto-text"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
						</svg>
						<div>
							<h3 className="text-lg font-semibold text-otto-text">Windows</h3>
							<p className="text-[10px] text-otto-dim">v{release.version}</p>
						</div>
					</div>
					<div className="space-y-2">
						{release.windowsMsi && (
							<DownloadButton
								href={release.windowsMsi.url}
								label="x86_64"
								ext=".msi"
								size={release.windowsMsi.size}
							/>
						)}
						{release.windowsExe && (
							<DownloadButton
								href={release.windowsExe.url}
								label="x86_64"
								ext=".exe"
								size={release.windowsExe.size}
							/>
						)}
					</div>
				</div>

				<div className="bg-otto-bg p-6 sm:p-8 space-y-3">
					<div className="flex items-center gap-3 mb-4">
						<svg
							className="w-6 h-6 text-otto-text"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 0 0-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.368 1.884 1.368.39 0 .739-.134 1.107-.534.117.109.272.186.398.186.553 0 1.109-1.107 1.171-2.174.066-1.146-.142-2.074-.142-2.074s.476-.528.945-1.251c.453-.697.838-1.544.838-2.449 0-.543-.16-.723-.16-1.063 0-.34.199-.795.199-1.458 0-1.076-.535-1.746-1.292-2.478-.8-.8-1.851-1.293-2.334-2.259-.37-.72-.533-1.905-.672-3.019C16.031 1.995 15.068 0 12.504 0z" />
						</svg>
						<div>
							<h3 className="text-lg font-semibold text-otto-text">Linux</h3>
							<p className="text-[10px] text-otto-dim">v{release.version}</p>
						</div>
					</div>
					<div className="space-y-2">
						{release.linuxDeb && (
							<DownloadButton
								href={release.linuxDeb.url}
								label="x86_64"
								ext=".deb"
								size={release.linuxDeb.size}
							/>
						)}
						{release.linuxDebArm && (
							<DownloadButton
								href={release.linuxDebArm.url}
								label="ARM64"
								ext=".deb"
								size={release.linuxDebArm.size}
							/>
						)}
					</div>
					<p className="text-[10px] text-otto-dim">
						<code className="bg-otto-surface px-1.5 py-0.5 rounded text-otto-muted">
							sudo dpkg -i otto-launcher_*.deb
						</code>
					</p>
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

export function LauncherSection() {
	return (
		<section
			id="launcher"
			className="py-28 sm:py-36 px-6 border-t border-otto-border"
		>
			<div className="max-w-[900px] mx-auto">
				<Reveal>
					<p className="text-otto-dim text-xs uppercase tracking-[0.2em] mb-4">
						Launcher
					</p>
					<h2 className="text-2xl sm:text-3xl font-bold mb-3">
						Team development environments
					</h2>
					<p className="text-otto-muted text-sm mb-12 max-w-lg">
						One-click setup for shared dev environments. Create teams, manage
						deploy keys, clone repos, and spin up containerized workspaces with
						Docker.
					</p>
				</Reveal>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-16">
					<Reveal delay={40}>
						<LauncherMockup />
					</Reveal>

					<Reveal delay={80}>
						<div className="space-y-4">
							<div className="flex gap-4">
								<div className="w-9 h-9 rounded-lg bg-otto-surface border border-otto-border flex items-center justify-center flex-shrink-0">
									<svg
										className="w-4 h-4 text-otto-text"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
										<circle cx="9" cy="7" r="4" />
										<line x1="19" x2="19" y1="8" y2="14" />
										<line x1="22" x2="16" y1="11" y2="11" />
									</svg>
								</div>
								<div>
									<h3 className="text-sm font-semibold text-otto-text mb-1">
										Team management
									</h3>
									<p className="text-xs text-otto-muted leading-relaxed">
										Create teams with shared deploy keys and git identities.
										Import teammates by sharing{' '}
										<code className="text-[10px] bg-otto-surface px-1 py-0.5 rounded">
											.otto
										</code>{' '}
										config files.
									</p>
								</div>
							</div>

							<div className="flex gap-4">
								<div className="w-9 h-9 rounded-lg bg-otto-surface border border-otto-border flex items-center justify-center flex-shrink-0">
									<svg
										className="w-4 h-4 text-otto-text"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
									</svg>
								</div>
								<div>
									<h3 className="text-sm font-semibold text-otto-text mb-1">
										Docker containers
									</h3>
									<p className="text-xs text-otto-muted leading-relaxed">
										Isolated containerized workspaces per project. Auto-installs
										dependencies, configures SSH, and starts otto inside the
										container.
									</p>
								</div>
							</div>

							<div className="flex gap-4">
								<div className="w-9 h-9 rounded-lg bg-otto-surface border border-otto-border flex items-center justify-center flex-shrink-0">
									<svg
										className="w-4 h-4 text-otto-text"
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
								</div>
								<div>
									<h3 className="text-sm font-semibold text-otto-text mb-1">
										Automated 6-step setup
									</h3>
									<p className="text-xs text-otto-muted leading-relaxed">
										Add a project, enter the repo URL, and watch the automated
										pipeline. System packages, SSH, git, clone, deps, and otto —
										all handled.
									</p>
								</div>
							</div>

							<div className="flex gap-4">
								<div className="w-9 h-9 rounded-lg bg-otto-surface border border-otto-border flex items-center justify-center flex-shrink-0">
									<svg
										className="w-4 h-4 text-otto-text"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<rect x="2" y="3" width="20" height="14" rx="2" />
										<line x1="8" x2="16" y1="21" y2="21" />
										<line x1="12" x2="12" y1="17" y2="21" />
									</svg>
								</div>
								<div>
									<h3 className="text-sm font-semibold text-otto-text mb-1">
										Cross-platform
									</h3>
									<p className="text-xs text-otto-muted leading-relaxed">
										Native Tauri v2 app for macOS, Windows, and Linux. Manage
										multiple projects with start, stop, restart, and update
										controls.
									</p>
								</div>
							</div>
						</div>
					</Reveal>
				</div>

				<LauncherDownloads />
			</div>
		</section>
	);
}
