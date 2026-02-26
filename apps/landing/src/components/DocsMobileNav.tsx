const NAV_ITEMS = [
	{ href: '/docs', label: 'Installation & Setup', end: true },
	{ href: '/docs/usage', label: 'Usage Guide' },
	{ href: '/docs/configuration', label: 'Configuration' },
	{ href: '/docs/agents-tools', label: 'Agents & Tools' },
	{ href: '/docs/mcp', label: 'MCP Servers' },
	{ href: '/docs/sharing', label: 'Session Sharing' },
	{ href: '/docs/acp', label: 'ACP Integration' },
	{ href: '/docs/architecture', label: 'System Architecture' },
	{ href: '/docs/embedding', label: 'Embedding Guide' },
	{ href: '/docs/api', label: 'API Reference' },
	{ href: '/docs/ai-sdk', label: 'Overview', end: true },
	{ href: '/docs/ai-sdk/configuration', label: 'Configuration' },
	{ href: '/docs/ai-sdk/caching', label: 'Caching' },
	{ href: '/docs/setu', label: 'Overview', end: true },
	{ href: '/docs/setu/payments', label: 'Payments' },
	{ href: '/docs/setu/integration', label: 'Integration Guide' },
	{ href: '/docs/setu/openclaw', label: 'OpenClaw Plugin' },
];

function isActive(pathname: string, href: string, end?: boolean): boolean {
	const clean = pathname.replace(/\/$/, '') || '/';
	const target = href.replace(/\/$/, '') || '/';
	if (end) return clean === target;
	return clean === target || clean.startsWith(target + '/');
}

export function DocsMobileNav({ pathname }: { pathname: string }) {
	return (
		<div className="lg:hidden mb-8 -mx-6 px-6 overflow-x-auto pb-3 border-b border-otto-border scrollbar-hide">
			<div className="flex gap-1 w-max">
				{NAV_ITEMS.map((item) => {
					const active = isActive(pathname, item.href, item.end);
					return (
						<a
							key={item.href}
							href={item.href}
							className={`px-3 py-1.5 text-xs rounded-sm whitespace-nowrap transition-colors ${
								active
									? 'bg-otto-card text-otto-text border border-otto-border'
									: 'text-otto-muted hover:text-otto-text'
							}`}
						>
							{item.label}
						</a>
					);
				})}
			</div>
		</div>
	);
}
