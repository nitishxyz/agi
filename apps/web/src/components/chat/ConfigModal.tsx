import { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { useConfig, useModels } from '../../hooks/useConfig';

interface ConfigModalProps {
	isOpen: boolean;
	onClose: () => void;
	agent: string;
	provider: string;
	model: string;
	onAgentChange: (agent: string) => void;
	onProviderChange: (provider: string) => void;
	onModelChange: (model: string) => void;
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
}: ConfigModalProps) {
	const { data: config, isLoading: configLoading } = useConfig();
	const { data: modelsData, isLoading: modelsLoading } = useModels(provider);

	// Generate unique IDs for form elements
	const agentId = useId();
	const providerId = useId();
	const modelId = useId();

	// Set defaults when config loads
	useEffect(() => {
		if (config && !agent && !provider && !model) {
			onAgentChange(config.defaults.agent);
			onProviderChange(config.defaults.provider);
			onModelChange(config.defaults.model);
		}
	}, [
		config,
		agent,
		provider,
		model,
		onAgentChange,
		onProviderChange,
		onModelChange,
	]);

	// Update model when provider changes
	useEffect(() => {
		if (modelsData && modelsData.models.length > 0) {
			const currentModelExists = modelsData.models.some((m) => m.id === model);
			if (!currentModelExists) {
				onModelChange(modelsData.default || modelsData.models[0].id);
			}
		}
	}, [modelsData, model, onModelChange]);

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
									<label
										htmlFor={agentId}
										className="block text-sm font-medium text-foreground mb-2"
									>
										Agent
									</label>
									<select
										id={agentId}
										value={agent}
										onChange={(e) => onAgentChange(e.target.value)}
										className="w-full bg-background border border-border rounded px-3 py-2 text-foreground outline-none focus:border-violet-500 transition-colors"
									>
										{config.agents.map((a) => (
											<option key={a} value={a}>
												{a}
											</option>
										))}
									</select>
								</div>

								<div>
									<label
										htmlFor={providerId}
										className="block text-sm font-medium text-foreground mb-2"
									>
										Provider
									</label>
									<select
										id={providerId}
										value={provider}
										onChange={(e) => onProviderChange(e.target.value)}
										className="w-full bg-background border border-border rounded px-3 py-2 text-foreground outline-none focus:border-violet-500 transition-colors"
									>
										{config.providers.map((p) => (
											<option key={p} value={p}>
												{p}
											</option>
										))}
									</select>
								</div>

								<div>
									<label
										htmlFor={modelId}
										className="block text-sm font-medium text-foreground mb-2"
									>
										Model
									</label>
									<select
										id={modelId}
										value={model}
										onChange={(e) => onModelChange(e.target.value)}
										disabled={modelsLoading || !modelsData}
										className="w-full bg-background border border-border rounded px-3 py-2 text-foreground outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
									>
										{modelsData?.models.map((m) => (
											<option key={m.id} value={m.id}>
												{m.label}
											</option>
										))}
									</select>
								</div>
							</>
						) : null}
					</div>
				</div>
			</div>
		</>
	);
}
