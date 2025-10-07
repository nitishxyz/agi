import { memo } from 'react';
import { Moon, Sun, Menu } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Theme } from '../../hooks/useTheme';
import { useSidebarStore } from '../../stores/sidebarStore';

interface HeaderProps {
	theme: Theme;
	onToggleTheme: () => void;
}

export const Header = memo(function Header({
	theme,
	onToggleTheme,
}: HeaderProps) {
	const toggleCollapse = useSidebarStore((state) => state.toggleCollapse);

	return (
		<header className="h-14 border-b border-border bg-background px-4 flex items-center justify-between">
			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon"
					onClick={toggleCollapse}
					className="md:hidden touch-manipulation"
					title="Toggle menu"
					aria-label="Toggle menu"
				>
					<Menu className="w-5 h-5" />
				</Button>
				<h1 className="text-lg font-semibold text-foreground">AGI</h1>
			</div>
			<div className="flex items-center gap-2">
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
		</header>
	);
});
