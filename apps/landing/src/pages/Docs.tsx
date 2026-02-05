import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import { GettingStarted } from "./docs/GettingStarted";
import { Usage } from "./docs/Usage";
import { Configuration } from "./docs/Configuration";
import { AgentsTools } from "./docs/AgentsTools";
import { Architecture } from "./docs/Architecture";
import { Embedding } from "./docs/Embedding";
import { ApiReference } from "./docs/ApiReference";

const NAV_SECTIONS = [
	{
		title: "Getting Started",
		items: [
			{ to: "/docs", label: "Installation & Setup", end: true },
			{ to: "/docs/usage", label: "Usage Guide" },
			{ to: "/docs/configuration", label: "Configuration" },
		],
	},
	{
		title: "Features",
		items: [
			{ to: "/docs/agents-tools", label: "Agents & Tools" },
		],
	},
	{
		title: "Architecture",
		items: [
			{ to: "/docs/architecture", label: "System Architecture" },
			{ to: "/docs/embedding", label: "Embedding Guide" },
			{ to: "/docs/api", label: "API Reference" },
		],
	},
];

function navLinkClass(isActive: boolean) {
	return `block py-2 text-sm transition-colors truncate ${
		isActive
			? "bg-otto-card text-otto-text px-4"
			: "text-otto-muted hover:text-otto-text px-4"
	}`;
}

function Sidebar() {
	return (
	<aside className="w-64 shrink-0 hidden lg:flex flex-col border-r border-otto-border fixed top-14 bottom-0 left-0 overflow-y-auto">
		<div className="flex-1 py-6 space-y-6">
			{NAV_SECTIONS.map((section) => (
				<div key={section.title}>
					<h4 className="text-[10px] font-semibold text-otto-dim uppercase tracking-[0.15em] mb-2 px-4">
						{section.title}
						</h4>
						<div className="space-y-0.5">
							{section.items.map((item) => (
								<NavLink
									key={item.to}
									to={item.to}
									end={"end" in item ? item.end : false}
									className={({ isActive }) => navLinkClass(isActive)}
								>
									{item.label}
								</NavLink>
							))}
						</div>
					</div>
				))}
			</div>

		</aside>
	);
}

function MobileNav() {
	return (
		<div className="lg:hidden mb-8 -mx-6 px-6 overflow-x-auto pb-3 border-b border-otto-border scrollbar-hide">
			<div className="flex gap-1 w-max">
				{NAV_SECTIONS.flatMap((s) => s.items).map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						end={"end" in item ? item.end : false}
						className={({ isActive }) =>
							`px-3 py-1.5 text-xs rounded-sm whitespace-nowrap transition-colors ${
								isActive
									? "bg-otto-card text-otto-text border border-otto-border"
									: "text-otto-muted hover:text-otto-text"
							}`
						}
					>
						{item.label}
					</NavLink>
				))}
			</div>
		</div>
	);
}

export function Docs() {
	return (
		<div className="pt-14 min-h-screen">
			<Sidebar />
			<div className="lg:ml-64">
				<main className="max-w-3xl mx-auto px-6 py-10 pb-24">
					<MobileNav />
					<div className="prose-otto">
						<Routes>
							<Route index element={<GettingStarted />} />
							<Route path="usage" element={<Usage />} />
							<Route path="configuration" element={<Configuration />} />
							<Route path="agents-tools" element={<AgentsTools />} />
							<Route path="architecture" element={<Architecture />} />
							<Route path="embedding" element={<Embedding />} />
							<Route path="api" element={<ApiReference />} />
							<Route path="*" element={<Navigate to="/docs" replace />} />
						</Routes>
					</div>
				</main>
			</div>
		</div>
	);
}
