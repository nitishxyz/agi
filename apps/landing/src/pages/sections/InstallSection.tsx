import { Link } from 'react-router-dom';
import { OttoWordmark } from '../../components/OttoWordmark';
import { Reveal } from '../../components/Reveal';
import { TerminalBlock } from '../../components/TerminalBlock';

export function InstallSection() {
	return (
		<section
			id="install"
			className="py-28 sm:py-36 px-6 border-t border-otto-border"
		>
			<div className="max-w-[600px] mx-auto">
				<Reveal>
					<OttoWordmark height={28} className="text-otto-text mb-8" />
					<p className="text-otto-muted text-sm mb-10 max-w-sm">
						One command. Open source. MIT license.
					</p>
				</Reveal>

				<Reveal delay={80}>
					<TerminalBlock copyText="curl -fsSL https://install.ottocode.io | sh">
						<div>
							<span className="text-otto-dim">$</span> curl -fsSL
							https://install.ottocode.io | sh
						</div>
					</TerminalBlock>
				</Reveal>

				<Reveal delay={120}>
					<p className="text-otto-dim text-xs mt-6 mb-4">or</p>
					<TerminalBlock copyText="bun install -g @ottocode/install">
						<div>
							<span className="text-otto-dim">$</span> bun install -g
							@ottocode/install
						</div>
					</TerminalBlock>
				</Reveal>

				<Reveal delay={160}>
					<div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-10">
						<a
							href="#desktop"
							className="px-5 py-2.5 bg-otto-text text-otto-bg text-sm font-medium rounded-sm hover:opacity-80 transition-colors flex items-center gap-2"
						>
							<svg
								className="w-4 h-4"
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
	);
}
