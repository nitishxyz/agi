import { memo } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Theme } from '../../hooks/useTheme';

interface HeaderProps {
	theme: Theme;
	onToggleTheme: () => void;
}

export const Header = memo(function Header({
	theme,
	onToggleTheme,
}: HeaderProps) {
	return (
		<header className="h-14 border-b border-border bg-background px-4 flex items-center justify-between">
			<h1 className="text-lg font-semibold text-foreground">AGI</h1>
			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon"
					onClick={onToggleTheme}
					title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
					aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
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
