import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
	text: string;
	label?: string;
}

export function CopyBlock({ text, label }: Props) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="relative">
			{label && (
				<div className="text-xs text-muted-foreground mb-1">{label}</div>
			)}
			<pre className="p-3 rounded-md bg-secondary text-xs overflow-auto max-h-24 pr-10 break-all whitespace-pre-wrap">
				{text}
			</pre>
			<button
				type="button"
				onClick={handleCopy}
				className="absolute top-2 right-2 p-1.5 rounded bg-background/80 hover:bg-background transition-colors"
			>
				{copied ? (
					<Check size={12} className="text-green-500" />
				) : (
					<Copy size={12} />
				)}
			</button>
		</div>
	);
}
