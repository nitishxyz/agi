import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

type ColorVariant =
	| 'default'
	| 'blue'
	| 'emerald'
	| 'purple'
	| 'cyan'
	| 'amber'
	| 'red';

const colorClasses: Record<
	ColorVariant,
	{ normal: string; hover: string; error: string; errorHover: string }
> = {
	default: {
		normal: 'text-muted-foreground',
		hover: 'hover:text-foreground',
		error: 'text-red-700 dark:text-red-300',
		errorHover: 'hover:text-red-600 dark:hover:text-red-200',
	},
	blue: {
		normal: 'text-blue-700 dark:text-blue-300',
		hover: 'hover:text-blue-600 dark:hover:text-blue-200',
		error: 'text-red-700 dark:text-red-300',
		errorHover: 'hover:text-red-600 dark:hover:text-red-200',
	},
	emerald: {
		normal: 'text-emerald-700 dark:text-emerald-300',
		hover: 'hover:text-emerald-600 dark:hover:text-emerald-200',
		error: 'text-red-700 dark:text-red-300',
		errorHover: 'hover:text-red-600 dark:hover:text-red-200',
	},
	purple: {
		normal: 'text-purple-700 dark:text-purple-300',
		hover: 'hover:text-purple-600 dark:hover:text-purple-200',
		error: 'text-red-700 dark:text-red-300',
		errorHover: 'hover:text-red-600 dark:hover:text-red-200',
	},
	cyan: {
		normal: 'text-cyan-700 dark:text-cyan-300',
		hover: 'hover:text-cyan-600 dark:hover:text-cyan-200',
		error: 'text-red-700 dark:text-red-300',
		errorHover: 'hover:text-red-600 dark:hover:text-red-200',
	},
	amber: {
		normal: 'text-amber-700 dark:text-amber-300',
		hover: 'hover:text-amber-600 dark:hover:text-amber-200',
		error: 'text-red-700 dark:text-red-300',
		errorHover: 'hover:text-red-600 dark:hover:text-red-200',
	},
	red: {
		normal: 'text-red-700 dark:text-red-300',
		hover: 'hover:text-red-600 dark:hover:text-red-200',
		error: 'text-red-700 dark:text-red-300',
		errorHover: 'hover:text-red-600 dark:hover:text-red-200',
	},
};

interface ToolHeaderProps {
	toolName: string;
	isExpanded: boolean;
	onToggle: () => void;
	isError?: boolean;
	colorVariant?: ColorVariant;
	canExpand?: boolean;
	children?: ReactNode;
}

export function ToolHeader({
	toolName,
	isExpanded,
	onToggle,
	isError = false,
	colorVariant = 'default',
	canExpand = true,
	children,
}: ToolHeaderProps) {
	const colors = colorClasses[colorVariant];
	const colorClass = isError
		? `${colors.error} ${colors.errorHover}`
		: `${colors.normal} ${colors.hover}`;

	return (
		<button
			type="button"
			onClick={() => canExpand && onToggle()}
			className={`flex items-center gap-2 transition-colors w-full min-w-0 ${colorClass}`}
		>
			{canExpand ? (
				isExpanded ? (
					<ChevronDown className="h-3 w-3 flex-shrink-0" />
				) : (
					<ChevronRight className="h-3 w-3 flex-shrink-0" />
				)
			) : (
				<div className="w-3 flex-shrink-0" />
			)}
			{isError && (
				<AlertCircle className="h-3 w-3 flex-shrink-0 text-red-600 dark:text-red-400" />
			)}
			<span className="font-medium flex-shrink-0">
				{toolName}
				{isError ? ' error' : ''}
			</span>
			{children}
		</button>
	);
}

export function ToolHeaderSeparator() {
	return <span className="text-muted-foreground/70 flex-shrink-0">·</span>;
}

export function ToolHeaderDetail({
	children,
	className = '',
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<span className={`text-foreground/70 ${className}`}>{children}</span>
	);
}

export function ToolHeaderMeta({
	children,
	className = '',
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={`text-muted-foreground/80 flex-shrink-0 whitespace-nowrap ${className}`}
		>
			{children}
		</span>
	);
}

export function ToolHeaderSuccess({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<span className="text-emerald-600 dark:text-emerald-400 flex-shrink-0">
			{children}
		</span>
	);
}

export function ToolHeaderError({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<span className="text-red-600 dark:text-red-400 flex-shrink-0">
			{children}
		</span>
	);
}
