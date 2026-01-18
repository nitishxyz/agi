import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
	text: string;
	className?: string;
}

export function CopyButton({ text, className = '' }: CopyButtonProps) {
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
			className={`p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors ${className}`}
			title="Copy"
		>
			{copied ? (
				<Check className="h-3 w-3 text-emerald-500" />
			) : (
				<Copy className="h-3 w-3" />
			)}
		</button>
	);
}
