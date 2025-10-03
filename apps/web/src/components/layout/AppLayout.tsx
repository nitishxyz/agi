import type { ReactNode } from 'react';
import type { Theme } from '../../hooks/useTheme';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
	sidebar: ReactNode;
	children: ReactNode;
	onNewSession?: () => void;
	theme: Theme;
	onToggleTheme: () => void;
}

export function AppLayout({
	sidebar,
	children,
	onNewSession,
	theme,
	onToggleTheme,
}: AppLayoutProps) {
	return (
		<div className="h-screen flex flex-col bg-background">
			<Header
				onNewSession={onNewSession}
				onToggleTheme={onToggleTheme}
				theme={theme}
			/>
			<div className="flex-1 flex overflow-hidden">
				<Sidebar>{sidebar}</Sidebar>
				<main className="flex-1 flex flex-col overflow-hidden relative">
					{children}
				</main>
			</div>
		</div>
	);
}
