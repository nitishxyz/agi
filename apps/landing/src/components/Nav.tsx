import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { OttoWordmark } from './OttoWordmark';
import { useTheme } from '../hooks/useTheme';

function SunIcon() {
	return (
		<svg
			aria-hidden="true"
			className="w-4 h-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="5" />
			<line x1="12" y1="1" x2="12" y2="3" />
			<line x1="12" y1="21" x2="12" y2="23" />
			<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
			<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
			<line x1="1" y1="12" x2="3" y2="12" />
			<line x1="21" y1="12" x2="23" y2="12" />
			<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
			<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
		</svg>
	);
}

function MoonIcon() {
	return (
		<svg
			aria-hidden="true"
			className="w-4 h-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
		</svg>
	);
}

export function Nav() {
	const [scrolled, setScrolled] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const location = useLocation();
	const isDocs = location.pathname.startsWith('/docs');
	const { theme, toggle } = useTheme();
	const navigate = useNavigate();

	const handleSectionLink = (hash: string) => (e: React.MouseEvent) => {
		e.preventDefault();
		if (location.pathname !== '/') {
			navigate('/');
			setTimeout(() => {
				document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
			}, 100);
		} else {
			document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
		}
	};

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 20);
		window.addEventListener('scroll', onScroll);
		return () => window.removeEventListener('scroll', onScroll);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally trigger on route change
	useEffect(() => {
		setMobileOpen(false);
	}, [location]);

	return (
		<nav
			className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
				scrolled
					? 'bg-otto-bg/90 backdrop-blur-md border-b border-otto-border'
					: isDocs
						? 'bg-otto-bg border-b border-otto-border'
						: 'bg-transparent'
			}`}
		>
			<div className="h-14 flex items-center">
				<div className="w-64 shrink-0 hidden lg:flex items-center px-4">
					<Link to="/" className="flex items-center gap-2 group">
						<OttoWordmark height={18} className="text-otto-text" />
					</Link>
				</div>
				<div className="flex-1 flex items-center justify-between px-6 lg:px-8">
					<Link to="/" className="flex items-center gap-2 group lg:hidden">
						<OttoWordmark height={18} className="text-otto-text" />
					</Link>

					<div className="hidden md:flex items-center gap-5 text-[13px] ml-auto">
						<Link
							to="/docs"
							className="text-otto-muted hover:text-otto-text transition-colors"
						>
							Docs
						</Link>
						<a
							href="https://github.com/nitishxyz/otto"
							target="_blank"
							rel="noopener noreferrer"
							className="text-otto-muted hover:text-otto-text transition-colors"
						>
							GitHub
						</a>
						<button
							type="button"
							onClick={toggle}
							className="p-1.5 rounded-sm text-otto-muted hover:text-otto-text hover:bg-otto-card transition-colors"
							title={
								theme === 'dark'
									? 'Switch to light mode'
									: 'Switch to dark mode'
							}
						>
							{theme === 'dark' ? <SunIcon /> : <MoonIcon />}
						</button>
						<button
							type="button"
							onClick={handleSectionLink('install')}
							className="px-3.5 py-1.5 border border-otto-border text-otto-muted text-xs rounded-sm hover:border-otto-border-light hover:text-otto-text transition-colors"
						>
							Install
						</button>
						<button
							type="button"
							onClick={handleSectionLink('desktop')}
							className="px-3.5 py-1.5 bg-otto-text text-otto-bg text-xs font-medium rounded-sm hover:opacity-80 transition-colors flex items-center gap-1.5"
						>
							<svg
								aria-hidden="true"
								className="w-3.5 h-3.5"
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
							Desktop
						</button>
					</div>

					<div className="flex items-center gap-3 md:hidden">
						<button
							type="button"
							onClick={toggle}
							className="p-1.5 rounded-sm text-otto-muted hover:text-otto-text transition-colors"
							title={
								theme === 'dark'
									? 'Switch to light mode'
									: 'Switch to dark mode'
							}
						>
							{theme === 'dark' ? <SunIcon /> : <MoonIcon />}
						</button>
						<button
							type="button"
							onClick={() => setMobileOpen(!mobileOpen)}
							className="text-otto-muted hover:text-otto-text"
						>
							<svg
								aria-hidden="true"
								width="20"
								height="20"
								viewBox="0 0 20 20"
								fill="none"
							>
								{mobileOpen ? (
									<path
										d="M5 5L15 15M15 5L5 15"
										stroke="currentColor"
										strokeWidth="1.5"
									/>
								) : (
									<path
										d="M3 6H17M3 10H17M3 14H17"
										stroke="currentColor"
										strokeWidth="1.5"
									/>
								)}
							</svg>
						</button>
					</div>
				</div>
			</div>

			{mobileOpen && (
				<div className="md:hidden bg-otto-bg/95 backdrop-blur-md border-b border-otto-border px-6 py-4 space-y-3 text-sm">
					<Link
						to="/docs"
						className="block text-otto-muted hover:text-otto-text"
					>
						Docs
					</Link>
					<a
						href="https://github.com/nitishxyz/otto"
						target="_blank"
						rel="noopener noreferrer"
						className="block text-otto-muted hover:text-otto-text"
					>
						GitHub
					</a>
					<button
						type="button"
						onClick={handleSectionLink('install')}
						className="block text-otto-muted hover:text-otto-text"
					>
						Install
					</button>
					<button
						type="button"
						onClick={handleSectionLink('desktop')}
						className="block text-otto-muted hover:text-otto-text"
					>
						Desktop App
					</button>
				</div>
			)}
		</nav>
	);
}
