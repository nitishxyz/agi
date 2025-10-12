import { X } from 'lucide-react';
import { useConfig } from '../../hooks/useConfig';
import { UnifiedModelSelector } from './UnifiedModelSelector';
import { UnifiedAgentSelector } from './UnifiedAgentSelector';

interface ConfigModalProps {
	isOpen: boolean;
	onClose: () => void;
	agent: string;
	provider: string;
	model: string;
	onAgentChange: (agent: string) => void;
	onProviderChange: (provider: string) => void;
	onModelChange: (model: string) => void;
	onModelSelectorChange?: (provider: string, model: string) => void;
}

export function ConfigModal({
	isOpen,
	onClose,
	agent,
	provider,
	model,
	onAgentChange,
	onProviderChange,
	onModelChange,
	onModelSelectorChange,
}: ConfigModalProps) {
	const { data: config, isLoading: configLoading } = useConfig();

	if (!isOpen) return null;

	const handleBackdropClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	const handleBackdropKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
		if (e.key === 'Escape') {
			onClose();
		}
	};

	const handleModelChange = (
		selectedProvider: string,
		selectedModel: string,
	) => {
		if (onModelSelectorChange) {
			onModelSelectorChange(selectedProvider, selectedModel);
		} else {
			onProviderChange(selectedProvider);
			onModelChange(selectedModel);
		}
	};

	return (
		<>
			<button
				type="button"
				className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 cursor-default"
				onClick={handleBackdropClick}
				onKeyDown={handleBackdropKeyDown}
				aria-label="Close modal"
			/>
			<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
				<div className="bg-background border border-border rounded-lg shadow-lg">
					<div className="flex items-center justify-between p-4 border-b border-border">
						<h2 className="text-lg font-semibold text-foreground">
							Configuration
						</h2>
						<button
							type="button"
							onClick={onClose}
							className="text-muted-foreground hover:text-foreground transition-colors"
						>
							<X className="h-5 w-5" />
						</button>
					</div>

					<div className="p-4 space-y-4">
						{configLoading ? (
							<div className="text-center text-muted-foreground py-8">
								Loading configuration...
							</div>
						) : config ? (
							<>
								<div>
									<div className="block text-sm font-medium text-foreground mb-2">
										Agent
									</div>
									<UnifiedAgentSelector
										agent={agent}
										agents={config.agents}
										onChange={onAgentChange}
									/>
								</div>

								<div>
									<div className="block text-sm font-medium text-foreground mb-2">
										Provider / Model
									</div>
									<UnifiedModelSelector
										provider={provider}
										model={model}
										onChange={handleModelChange}
									/>
								</div>
							</>
						) : null}
					</div>
				</div>
			</div>
		</>
	);
}
