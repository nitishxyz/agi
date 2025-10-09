import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className = '', ...props }, ref) => {
		return (
			<textarea
				ref={ref}
				className={`w-full px-3 py-2 bg-muted border border-border rounded text-foreground placeholder-muted-foreground outline-none resize-none ${className}`}
				{...props}
			/>
		);
	},
);

Textarea.displayName = 'Textarea';
