import type { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
	sidebar: ReactNode;
	children: ReactNode;
	onNewSession?: () => void;
}

export function AppLayout({ sidebar, children, onNewSession }: AppLayoutProps) {
	return (
		<div className="h-screen flex flex-col bg-background">
			<Header onNewSession={onNewSession} />
			<div className="flex-1 flex overflow-hidden">
				<Sidebar>{sidebar}</Sidebar>
				<main className="flex-1 flex flex-col overflow-hidden relative">
					{children}
				</main>
			</div>
		</div>
	);
}
