import { memo } from 'react';
import type { ReactNode } from 'react';
import type { Theme } from '@agi-cli/web-sdk/hooks';
import {
	GitSidebarToggle,
	GitSidebar,
	TerminalsSidebarToggle,
	TerminalsSidebar,
	GitDiffPanel,
	GitCommitModal,
	ConfirmationDialog,
	Button,
	SessionFilesSidebarToggle,
	SessionFilesSidebar,
	SessionFilesDiffPanel,
} from '@agi-cli/web-sdk/components';
import { Sidebar } from './Sidebar';
import { Moon, Sun } from 'lucide-react';

interface AppLayoutProps {
	sidebar: ReactNode;
	children: ReactNode;
	onNewSession?: () => void;
	theme: Theme;
	onToggleTheme: () => void;
	sessionId?: string;
}

export const AppLayout = memo(function AppLayout({
	sidebar,
	children,
	onNewSession,
	theme,
	onToggleTheme,
	sessionId,
}: AppLayoutProps) {
	return (
		<div className="h-screen flex bg-background touch-manipulation border-t border-border/50">
			{/* Left sidebar - Sessions */}
			<Sidebar onNewSession={onNewSession}>{sidebar}</Sidebar>

			{/* Main content area */}
			<main className="flex-1 flex flex-col overflow-hidden relative w-full md:w-auto">
				{/* Diff panels overlay this when open */}
				<GitDiffPanel />
				<SessionFilesDiffPanel />
				{children}
			</main>

			{/* Right sidebar - Git (hidden on mobile) */}
			<div className="hidden md:flex">
				{/* Panels - expand when toggled */}
				<GitSidebar />
				<SessionFilesSidebar sessionId={sessionId} />
				<TerminalsSidebar />

				{/* Tab buttons - always visible, stacked vertically, full height */}
				<div className="flex flex-col w-12 border-l border-border bg-background">
					<GitSidebarToggle />
					<SessionFilesSidebarToggle sessionId={sessionId} />
					<TerminalsSidebarToggle />
					<div className="flex-1" />
					<div className="h-12 border-t border-border flex items-center justify-center">
						<Button
							variant="ghost"
							size="icon"
							onClick={onToggleTheme}
							title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
							aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
							className="touch-manipulation"
						>
							{theme === 'dark' ? (
								<Sun className="w-4 h-4" />
							) : (
								<Moon className="w-4 h-4" />
							)}
						</Button>
					</div>
				</div>
			</div>

			{/* Modals */}
			<GitCommitModal />
			<ConfirmationDialog />
		</div>
	);
});
