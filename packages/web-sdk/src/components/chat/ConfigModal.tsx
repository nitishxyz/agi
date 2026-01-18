import { useEffect, useRef } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { usePreferences } from '../../hooks/usePreferences';
import { Modal } from '../ui/Modal';
import {
	UnifiedModelSelector,
	type UnifiedModelSelectorRef,
} from './UnifiedModelSelector';
import {
	UnifiedAgentSelector,
	type UnifiedAgentSelectorRef,
} from './UnifiedAgentSelector';

interface ConfigModalProps {
	isOpen: boolean;
	onClose: () => void;
	initialFocus?: 'agent' | 'model' | null;
	chatInputRef?: React.RefObject<{ focus: () => void }>;
	agent: string;
	provider: string;
	model: string;
	modelSupportsReasoning?: boolean;
	onAgentChange: (agent: string) => void;
	onProviderChange: (provider: string) => void;
	onModelChange: (model: string) => void;
	onModelSelectorChange?: (provider: string, model: string) => void;
}

export function ConfigModal({
	isOpen,
	onClose,
	initialFocus,
	chatInputRef,
	agent,
	provider,
	model,
	modelSupportsReasoning,
	onAgentChange,
	onProviderChange,
	onModelChange,
	onModelSelectorChange,
}: ConfigModalProps) {
	const { data: config, isLoading: configLoading } = useConfig();
	const { preferences, updatePreferences } = usePreferences();
	const agentSelectorRef = useRef<UnifiedAgentSelectorRef>(null);
	const modelSelectorRef = useRef<UnifiedModelSelectorRef>(null);

	useEffect(() => {
		if (isOpen && initialFocus) {
			setTimeout(() => {
				if (initialFocus === 'agent') {
					agentSelectorRef.current?.openAndFocus();
				} else if (initialFocus === 'model') {
					modelSelectorRef.current?.openAndFocus();
				}
			}, 100);
		}
	}, [isOpen, initialFocus]);

	const handleClose = () => {
		onClose();
		// Focus chat input after modal closes
		setTimeout(() => {
			chatInputRef?.current?.focus();
		}, 100);
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
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Configuration"
			closeOnEscape={true}
			closeOnBackdropClick={true}
		>
			{configLoading ? (
				<div className="text-center text-muted-foreground py-8">
					Loading configuration...
				</div>
			) : config ? (
				<div className="space-y-4">
					<div>
						<div className="block text-sm font-medium text-foreground mb-2">
							Agent
						</div>
						<UnifiedAgentSelector
							ref={agentSelectorRef}
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
							ref={modelSelectorRef}
							provider={provider}
							model={model}
							onChange={handleModelChange}
						/>
					</div>

					{modelSupportsReasoning && (
						<div className="flex items-center justify-between py-2">
							<div>
								<div className="text-sm font-medium text-foreground">
									Extended Thinking
								</div>
								<div className="text-xs text-muted-foreground">
									Enable reasoning for deeper analysis
								</div>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={preferences.reasoningEnabled}
								onClick={() =>
									updatePreferences({
										reasoningEnabled: !preferences.reasoningEnabled,
									})
								}
								className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
									preferences.reasoningEnabled ? 'bg-primary' : 'bg-muted'
								}`}
							>
								<span
									className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
										preferences.reasoningEnabled
											? 'translate-x-6'
											: 'translate-x-1'
									} ${preferences.reasoningEnabled ? 'bg-primary-foreground' : 'bg-foreground'}`}
								/>
							</button>
						</div>
					)}
				</div>
			) : null}
		</Modal>
	);
}
