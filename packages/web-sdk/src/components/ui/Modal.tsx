import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string | React.ReactNode;
	children: ReactNode;
	showCloseButton?: boolean;
	closeOnBackdropClick?: boolean;
	closeOnEscape?: boolean;
	maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const maxWidthClasses = {
	sm: 'max-w-sm',
	md: 'max-w-md',
	lg: 'max-w-lg',
	xl: 'max-w-xl',
	'2xl': 'max-w-2xl',
};

export function Modal({
	isOpen,
	onClose,
	title,
	children,
	showCloseButton = true,
	closeOnBackdropClick = true,
	closeOnEscape = true,
	maxWidth = 'md',
}: ModalProps) {
	useEffect(() => {
		if (!isOpen || !closeOnEscape) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, [isOpen, closeOnEscape, onClose]);

	useEffect(() => {
		if (isOpen) {
			// Prevent body scroll when modal is open
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = '';
			};
		}
	}, [isOpen]);

	if (!isOpen) return null;

	const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (closeOnBackdropClick && e.target === e.currentTarget) {
			onClose();
		}
	};

	return (
		<>
			{/* Backdrop */}
			<button
				type="button"
				className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] cursor-default"
				onClick={handleBackdropClick}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						handleBackdropClick(
							e as unknown as React.MouseEvent<HTMLDivElement>,
						);
					}
				}}
				aria-label="Close modal"
			/>

			{/* Modal Container */}
			<div
				className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-full ${maxWidthClasses[maxWidth]} px-4`}
			>
				<div className="bg-background border border-border rounded-lg shadow-lg">
					{/* Header */}
					{(title || showCloseButton) && (
						<div className="flex items-center justify-between p-4 border-b border-border">
							{title && (
								<div className="text-lg font-semibold text-foreground">
									{title}
								</div>
							)}
							{showCloseButton && (
								<button
									type="button"
									onClick={onClose}
									className="text-muted-foreground hover:text-foreground transition-colors ml-auto"
									aria-label="Close"
								>
									<X className="h-5 w-5" />
								</button>
							)}
						</div>
					)}

					{/* Content */}
					<div className="p-4">{children}</div>
				</div>
			</div>
		</>
	);
}
