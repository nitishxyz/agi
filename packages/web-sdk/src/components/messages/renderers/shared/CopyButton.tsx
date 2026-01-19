import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
	text: string;
	className?: string;
	size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
	sm: 'h-3 w-3',
	md: 'h-4 w-4',
	lg: 'h-5 w-5',
};

const paddingClasses = {
	sm: 'p-1',
	md: 'p-1.5',
	lg: 'p-2',
};

export function CopyButton({
	text,
	className = '',
	size = 'sm',
}: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async (e: React.MouseEvent) => {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {}
	};

	return (
		<button
			type="button"
			onClick={handleCopy}
			className={`${paddingClasses[size]} rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors ${className}`}
			title="Copy"
		>
			{copied ? (
				<Check className={`${sizeClasses[size]} text-emerald-500`} />
			) : (
				<Copy className={sizeClasses[size]} />
			)}
		</button>
	);
}
