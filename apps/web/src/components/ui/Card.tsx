import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
	({ className = '', children, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={`bg-zinc-900 border border-zinc-800 rounded-lg ${className}`}
				{...props}
			>
				{children}
			</div>
		);
	},
);

Card.displayName = 'Card';
