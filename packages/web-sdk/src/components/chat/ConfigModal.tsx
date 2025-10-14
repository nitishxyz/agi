import { useEffect, useRef } from 'react';
import { useConfig } from '../../hooks/useConfig';
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
	initialFocus,
	agent,
	provider,
	model,
	onAgentChange,
	onProviderChange,
	onModelChange,
	onModelSelectorChange,
}: ConfigModalProps) {
	const { data: config, isLoading: configLoading } = useConfig();
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
			onClose={onClose}
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
				</div>
			) : null}
		</Modal>
	);
}
