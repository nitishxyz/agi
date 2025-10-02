import { Plus } from 'lucide-react';
import { Button } from '../ui/Button';

interface HeaderProps {
	onNewSession?: () => void;
}

export function Header({ onNewSession }: HeaderProps) {
	return (
		<header className="h-14 border-b border-border bg-background px-4 flex items-center justify-between">
			<h1 className="text-lg font-semibold text-foreground">AGI</h1>
			<Button variant="primary" size="sm" onClick={onNewSession}>
				<Plus className="w-4 h-4 mr-2" />
				New Session
			</Button>
		</header>
	);
}
