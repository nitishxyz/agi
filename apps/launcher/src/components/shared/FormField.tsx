import { useId } from 'react';

interface Props {
	label: string;
	value: string;
	onChange: (val: string) => void;
	placeholder?: string;
	type?: string;
	autoFocus?: boolean;
	onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function FormField({
	label,
	value,
	onChange,
	placeholder,
	type = 'text',
	autoFocus: _autoFocus,
	onKeyDown,
}: Props) {
	const id = useId();
	return (
		<div className="space-y-1.5">
			<label htmlFor={id} className="text-xs text-muted-foreground">
				{label}
			</label>
			<input
				id={id}
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
				onKeyDown={onKeyDown}
			/>
		</div>
	);
}
