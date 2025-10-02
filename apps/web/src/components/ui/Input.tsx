import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	({ className = '', ...props }, ref) => {
		return (
			<input
				ref={ref}
				className={`w-full px-3 py-2 bg-muted border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${className}`}
				{...props}
			/>
		);
	},
);

Input.displayName = 'Input';
