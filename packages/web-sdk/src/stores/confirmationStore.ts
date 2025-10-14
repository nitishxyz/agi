import { create } from 'zustand';

interface ConfirmationState {
	isOpen: boolean;
	title: string;
	message: string;
	confirmLabel: string;
	cancelLabel: string;
	variant: 'default' | 'destructive';
	onConfirm: () => void | Promise<void>;
	onCancel?: () => void;

	openConfirmation: (options: {
		title?: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: 'default' | 'destructive';
		onConfirm: () => void | Promise<void>;
		onCancel?: () => void;
	}) => void;
	closeConfirmation: () => void;
}

export const useConfirmationStore = create<ConfirmationState>((set) => ({
	isOpen: false,
	title: 'Confirm Action',
	message: '',
	confirmLabel: 'Confirm',
	cancelLabel: 'Cancel',
	variant: 'default',
	onConfirm: () => {},
	onCancel: undefined,

	openConfirmation: (options) =>
		set({
			isOpen: true,
			title: options.title || 'Confirm Action',
			message: options.message,
			confirmLabel: options.confirmLabel || 'Confirm',
			cancelLabel: options.cancelLabel || 'Cancel',
			variant: options.variant || 'default',
			onConfirm: options.onConfirm,
			onCancel: options.onCancel,
		}),

	closeConfirmation: () =>
		set({
			isOpen: false,
			onConfirm: () => {},
			onCancel: undefined,
		}),
}));
