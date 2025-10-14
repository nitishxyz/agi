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

					<div>
						<div className="block text-sm font-medium text-foreground mb-2">
							Preferences
						</div>
						<label className="flex items-center gap-3 py-2 px-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors cursor-pointer">
							<input
								type="checkbox"
								checked={preferences.vimMode}
								onChange={(e) =>
									updatePreferences({ vimMode: e.target.checked })
								}
								className="w-4 h-4 rounded border-border bg-background checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/40 cursor-pointer"
							/>
							<div className="flex-1">
								<div className="text-sm font-medium text-foreground">Vim Mode</div>
								<div className="text-xs text-muted-foreground">
									Enable vim keybindings in chat input (Normal/Insert modes)
								</div>
							</div>
						</label>
					</div>
				</div>
			) : null}
		</Modal>
	);
}
