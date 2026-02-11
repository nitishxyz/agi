import { ArrowLeft } from 'lucide-react';

interface Props {
	onClick: () => void;
	label?: string;
}

export function BackButton({ onClick, label = 'Back' }: Props) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
		>
			<ArrowLeft size={12} />
			{label}
		</button>
	);
}
