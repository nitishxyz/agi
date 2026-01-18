import type { ReactNode } from 'react';
import { CopyButton } from './CopyButton';

interface ToolContentBoxProps {
	title: string;
	icon?: ReactNode;
	subtitle?: string;
	copyText?: string;
	variant?: 'default' | 'error';
	maxHeight?: string;
	children: ReactNode;
}

export function ToolContentBox({
	title,
	icon,
	subtitle,
	copyText,
	variant = 'default',
	maxHeight = 'max-h-80',
	children,
}: ToolContentBoxProps) {
	const isError = variant === 'error';

	return (
		<div
			className={`bg-card/60 border rounded-lg overflow-hidden flex flex-col ${maxHeight} ${
				isError ? 'border-red-500/50' : 'border-border'
			}`}
		>
			<div
				className={`flex items-center justify-between gap-2 text-xs px-3 py-1.5 border-b border-border sticky top-0 ${
					isError
						? 'text-red-600 dark:text-red-400 bg-red-500/10'
						: 'text-muted-foreground bg-muted/30'
				}`}
			>
				<div className="flex items-center gap-2">
					{icon}
					<span>{title}</span>
					{subtitle && (
						<span className="text-muted-foreground/60">{subtitle}</span>
					)}
				</div>
				{copyText && <CopyButton text={copyText} />}
			</div>
			<div className="overflow-auto flex-1">{children}</div>
		</div>
	);
}
