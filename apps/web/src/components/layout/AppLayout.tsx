import { memo } from 'react';
import type { ReactNode } from 'react';
import type { Theme } from '@ottocode/web-sdk/hooks';
import {
	GitSidebarToggle,
	GitSidebar,
	TerminalPanelToggle,
	TerminalsPanel,
	GitDiffPanel,
	GitCommitModal,
	ConfirmationDialog,
	Button,
	SessionFilesSidebarToggle,
	SessionFilesSidebar,
	SessionFilesDiffPanel,
	ResearchSidebar,
	ResearchSidebarToggle,
	SettingsSidebar,
	SettingsSidebarToggle,
} from '@ottocode/web-sdk/components';
import { Sidebar } from './Sidebar';
import { Moon, Sun } from 'lucide-react';

interface AppLayoutProps {
	sidebar: ReactNode;
	children: ReactNode;
	onNewSession?: () => void;
	theme: Theme;
	onToggleTheme: () => void;
	sessionId?: string;
	onNavigateToSession?: (sessionId: string) => void;
}

export const AppLayout = memo(function AppLayout({
	sidebar,
	children,
	onNewSession,
	theme,
	onToggleTheme,
	sessionId,
	onNavigateToSession,
}: AppLayoutProps) {
	return (
		<div className="h-screen flex bg-background touch-manipulation border-t border-border/50">
			{/* Left sidebar - Sessions */}
			<Sidebar onNewSession={onNewSession}>{sidebar}</Sidebar>

			{/* Main content area with bottom terminal panel */}
			<div className="flex-1 flex flex-col overflow-hidden w-full md:w-auto">
				<div className="flex-1 flex overflow-hidden">
					<main className="flex-1 flex flex-col overflow-hidden relative">
						<GitDiffPanel />
						<SessionFilesDiffPanel />
						{children}
					</main>

					{/* Right sidebar - Git (hidden on mobile) */}
					<div className="hidden md:flex">
						<GitSidebar />
						<SessionFilesSidebar sessionId={sessionId} />
						<ResearchSidebar
							parentSessionId={sessionId ?? null}
							onNavigateToSession={onNavigateToSession}
						/>
						<SettingsSidebar />

						<div className="flex flex-col w-12 border-l border-border bg-background">
							<GitSidebarToggle />
							<SessionFilesSidebarToggle sessionId={sessionId} />
							<ResearchSidebarToggle parentSessionId={sessionId} />
							<SettingsSidebarToggle />
							<div className="flex-1" />
							<TerminalPanelToggle />
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
				</div>

				{/* Bottom terminal panel */}
				<TerminalsPanel />
			</div>

			{/* Modals */}
			<GitCommitModal />
			<ConfirmationDialog />
		</div>
	);
});
