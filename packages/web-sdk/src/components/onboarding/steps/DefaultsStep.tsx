import { memo, useState, useEffect, useId } from 'react';
import { Loader2, ArrowLeft, Sparkles, ChevronDown } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import type { AuthStatus } from '../../../stores/onboardingStore';
import { ProviderLogo } from '../../common/ProviderLogo';

interface DefaultsStepProps {
	authStatus: AuthStatus;
	onComplete: () => Promise<void>;
	onBack: () => void;
}

interface ConfigData {
	agents: string[];
	providers: string[];
	defaults: {
		agent: string;
		provider: string;
		model: string;
		toolApproval?: 'auto' | 'dangerous' | 'all';
	};
}

type AllModels = Record<
	string,
	{
		label: string;
		models: Array<{ id: string; label: string }>;
	}
>;

export const DefaultsStep = memo(function DefaultsStep({
	authStatus,
	onComplete,
	onBack,
}: DefaultsStepProps) {
	const [config, setConfig] = useState<ConfigData | null>(null);
	const [allModels, setAllModels] = useState<AllModels | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	const [selectedProvider, setSelectedProvider] = useState(
		authStatus.defaults.provider || 'setu',
	);
	const [selectedModel, setSelectedModel] = useState(
		authStatus.defaults.model || '',
	);
	const [selectedAgent, setSelectedAgent] = useState(authStatus.defaults.agent);
	const [selectedApproval, setSelectedApproval] = useState<
		'auto' | 'dangerous' | 'all'
	>(authStatus.defaults.toolApproval || 'auto');

	const providerId = useId();
	const modelId = useId();
	const agentId = useId();
	const approvalId = useId();

	useEffect(() => {
		const loadConfig = async () => {
			try {
				const [configData, modelsData] = await Promise.all([
					apiClient.getConfig(),
					apiClient.getAllModels(),
				]);
				setConfig(configData);
				setAllModels(modelsData);
			} catch {
			} finally {
				setIsLoading(false);
			}
		};
		loadConfig();
	}, []);

	useEffect(() => {
		if (allModels?.[selectedProvider]) {
			const providerModels = allModels[selectedProvider];
			if (!providerModels.models.some((m) => m.id === selectedModel)) {
				setSelectedModel(providerModels.models[0]?.id || '');
			}
		}
	}, [selectedProvider, allModels, selectedModel]);

	const handleFinish = async () => {
		setIsSaving(true);
		try {
			await apiClient.updateDefaults({
				provider: selectedProvider,
				model: selectedModel,
				agent: selectedAgent,
				toolApproval: selectedApproval,
				scope: 'global',
			});
			await onComplete();
		} catch {
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const availableProviders = config?.providers.filter(
		(p) => authStatus.providers[p]?.configured || p === 'setu',
	) || ['setu'];

	const currentProviderModels = allModels?.[selectedProvider]?.models || [];

	return (
		<div className="min-h-screen flex flex-col">
			{/* Top Bar */}
			<div className="flex items-center justify-between px-6 py-4 border-b border-border">
				<div className="flex items-center gap-3">
					<ProviderLogo provider="setu" size={24} />
					<span className="font-semibold text-foreground">AGI</span>
				</div>
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<span className="w-2 h-2 rounded-full bg-blue-500" />
					Step 2 of 2
				</div>
			</div>

			{/* Main Content */}
			<div className="flex-1 px-6 py-8 lg:px-12 lg:py-12">
				<div className="max-w-7xl mx-auto">
					{/* Header */}
					<div className="mb-10">
						<h1 className="text-3xl lg:text-4xl font-semibold text-foreground mb-3">
							Configure Defaults
						</h1>
						<p className="text-lg text-muted-foreground">
							Set your preferences. You can change these anytime in settings.
						</p>
					</div>

					{/* Form */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* Provider */}
						<div className="md:col-span-2">
							<label
								htmlFor={providerId}
								className="block text-sm font-medium text-muted-foreground mb-2"
							>
								Default Provider
							</label>
							<div className="relative">
								<select
									id={providerId}
									value={selectedProvider}
									onChange={(e) => setSelectedProvider(e.target.value)}
									className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground appearance-none cursor-pointer focus:outline-none focus:border-ring transition-colors"
								>
									{availableProviders.map((p) => (
										<option key={p} value={p}>
											{authStatus.providers[p]?.label || p}
										</option>
									))}
								</select>
								<ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
							</div>
						</div>

						{/* Model */}
						<div className="md:col-span-2">
							<label
								htmlFor={modelId}
								className="block text-sm font-medium text-muted-foreground mb-2"
							>
								Default Model
							</label>
							<div className="relative">
								<select
									id={modelId}
									value={selectedModel}
									onChange={(e) => setSelectedModel(e.target.value)}
									className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground appearance-none cursor-pointer focus:outline-none focus:border-ring transition-colors"
								>
									{currentProviderModels.map((m) => (
										<option key={m.id} value={m.id}>
											{m.label || m.id}
										</option>
									))}
								</select>
								<ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
							</div>
						</div>

						{/* Agent */}
						<div>
							<label
								htmlFor={agentId}
								className="block text-sm font-medium text-muted-foreground mb-2"
							>
								Default Agent
							</label>
							<div className="relative">
								<select
									id={agentId}
									value={selectedAgent}
									onChange={(e) => setSelectedAgent(e.target.value)}
									className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground appearance-none cursor-pointer focus:outline-none focus:border-ring transition-colors"
								>
									{(config?.agents || ['build']).map((a) => (
										<option key={a} value={a}>
											{a}
										</option>
									))}
								</select>
								<ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
							</div>
						</div>

						{/* Tool Approval */}
						<div>
							<label
								htmlFor={approvalId}
								className="block text-sm font-medium text-muted-foreground mb-2"
							>
								Tool Approval
							</label>
							<div className="relative">
								<select
									id={approvalId}
									value={selectedApproval}
									onChange={(e) =>
										setSelectedApproval(
											e.target.value as 'auto' | 'dangerous' | 'all',
										)
									}
									className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground appearance-none cursor-pointer focus:outline-none focus:border-ring transition-colors"
								>
									<option value="auto">Auto - run without asking</option>
									<option value="dangerous">
										Dangerous - approve writes only
									</option>
									<option value="all">All - approve every tool</option>
								</select>
								<ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
							</div>
							<p className="mt-2 text-sm text-muted-foreground">
								Controls when tool executions need approval
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Bottom Bar */}
			<div className="px-6 py-4 border-t border-border">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					<button
						type="button"
						onClick={onBack}
						className="flex items-center gap-2 px-4 py-3 text-muted-foreground hover:text-foreground transition-colors"
					>
						<ArrowLeft className="w-4 h-4" />
						Back
					</button>
					<button
						type="button"
						onClick={handleFinish}
						disabled={isSaving}
						className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
					>
						{isSaving ? (
							<>
								<Loader2 className="w-4 h-4 animate-spin" />
								Setting up...
							</>
						) : (
							<>
								Start Using AGI
								<Sparkles className="w-4 h-4" />
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
});
