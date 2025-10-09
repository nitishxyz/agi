import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
	({ className = '', children, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={`bg-card text-card-foreground border border-border rounded-lg ${className}`}
				{...props}
			>
				{children}
			</div>
		);
	},
);

Card.displayName = 'Card';
