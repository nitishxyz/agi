import { memo, useState, useMemo } from 'react';
import {
	Settings,
	ChevronRight,
	Wallet,
	Cpu,
	Zap,
	User,
	ChevronDown,
	Shield,
	RefreshCw,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../ui/Button';
import { useSettingsStore } from '../../stores/settingsStore';
import {
	useConfig,
	useAllModels,
	useUpdateDefaults,
} from '../../hooks/useConfig';
import { usePreferences } from '../../hooks/usePreferences';
import { useSolforgeStore } from '../../stores/solforgeStore';
import { useSolforgeBalance } from '../../hooks/useSolforgeBalance';

interface SettingsSectionProps {
	title: string;
	icon: React.ReactNode;
	children: React.ReactNode;
	action?: React.ReactNode;
}

const SettingsSection = memo(function SettingsSection({
	title,
	icon,
	children,
	action,
}: SettingsSectionProps) {
	return (
		<div className="border-b border-border">
			<div className="px-4 py-3 flex items-center gap-2 bg-muted/30">
				{icon}
				<span className="text-sm font-medium flex-1">{title}</span>
				{action}
			</div>
			<div className="px-4 py-3 space-y-3">{children}</div>
		</div>
	);
});

interface SettingRowProps {
	label: string;
	value: React.ReactNode;
}

const SettingRow = memo(function SettingRow({ label, value }: SettingRowProps) {
	return (
		<div className="flex items-center justify-between text-sm">
			<span className="text-muted-foreground">{label}</span>
			<span className="font-mono text-foreground">{value}</span>
		</div>
	);
});

interface ToggleRowProps {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}

const ToggleRow = memo(function ToggleRow({
	label,
	checked,
	onChange,
}: ToggleRowProps) {
	return (
		<div className="flex items-center justify-between text-sm">
			<span className="text-muted-foreground">{label}</span>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				onClick={() => onChange(!checked)}
				className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
					checked ? 'bg-primary' : 'bg-muted'
				}`}
			>
				<span
					className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
						checked ? 'translate-x-6' : 'translate-x-1'
					} ${checked ? 'bg-primary-foreground' : 'bg-foreground'}`}
				/>
			</button>
		</div>
	);
});

interface SelectRowProps {
	label: string;
	value: string;
	options: Array<{ id: string; label: string }>;
	onChange: (value: string) => void;
	disabled?: boolean;
}

const SelectRow = memo(function SelectRow({
	label,
	value,
	options,
	onChange,
	disabled,
}: SelectRowProps) {
	const [isOpen, setIsOpen] = useState(false);
	const selectedOption = options.find((o) => o.id === value);

	return (
		<div className="flex items-center justify-between text-sm">
			<span className="text-muted-foreground">{label}</span>
			<div className="relative">
				<button
					type="button"
					onClick={() => !disabled && setIsOpen(!isOpen)}
					disabled={disabled}
					className="flex items-center gap-1 px-2 py-1 text-xs font-mono bg-muted hover:bg-muted/80 rounded border border-border disabled:opacity-50"
				>
					<span className="max-w-[120px] truncate">
						{selectedOption?.label || value || 'Select...'}
					</span>
					<ChevronDown className="w-3 h-3" />
				</button>
				{isOpen && (
					<>
						<div
							className="fixed inset-0 z-40"
							onClick={() => setIsOpen(false)}
						/>
						<div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] max-h-[200px] overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
							{options.map((option) => (
								<button
									key={option.id}
									type="button"
									onClick={() => {
										onChange(option.id);
										setIsOpen(false);
									}}
									className={`w-full px-3 py-2 text-left text-xs font-mono hover:bg-muted truncate ${
										option.id === value ? 'bg-muted/50' : ''
									}`}
								>
									{option.label}
								</button>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
});

export const SettingsSidebar = memo(function SettingsSidebar() {
	const isExpanded = useSettingsStore((state) => state.isExpanded);
	const collapseSidebar = useSettingsStore((state) => state.collapseSidebar);

	const { data: config } = useConfig();
	const { data: allModels } = useAllModels();
	const { preferences, updatePreferences } = usePreferences();
	const updateDefaults = useUpdateDefaults();
	const solforgeBalance = useSolforgeStore((s) => s.balance);
	const solforgeWallet = useSolforgeStore((s) => s.walletAddress);
	const solforgeUsdcBalance = useSolforgeStore((s) => s.usdcBalance);
	const solforgeLoading = useSolforgeStore((s) => s.isLoading);

	const hasSolforge = config?.providers?.includes('solforge');
	const { fetchBalance: refreshSolforgeBalance } = useSolforgeBalance(
		hasSolforge ? 'solforge' : undefined,
	);

	const providerOptions = useMemo(() => {
		if (!config?.providers || !allModels) return [];
		return config.providers
			.filter((p) => allModels[p])
			.map((p) => ({
				id: p,
				label: allModels[p]?.label || p,
			}));
	}, [config?.providers, allModels]);

	const modelOptions = useMemo(() => {
		const provider = config?.defaults?.provider;
		if (!provider || !allModels?.[provider]) return [];
		return allModels[provider].models.map((m) => ({
			id: m.id,
			label: m.label,
		}));
	}, [config?.defaults?.provider, allModels]);

	const agentOptions = useMemo(() => {
		if (!config?.agents) return [];
		return config.agents.map((a) => ({ id: a, label: a }));
	}, [config?.agents]);

	if (!isExpanded) return null;

	const handleProviderChange = (provider: string) => {
		const firstModel = allModels?.[provider]?.models?.[0]?.id;
		updateDefaults.mutate({
			provider,
			model: firstModel || config?.defaults?.model,
		});
	};

	const handleModelChange = (model: string) => {
		updateDefaults.mutate({ model });
	};

	const handleAgentChange = (agent: string) => {
		updateDefaults.mutate({ agent });
	};

	const truncateWallet = (address: string | null) => {
		if (!address) return 'Not configured';
		return `${address.slice(0, 4)}...${address.slice(-4)}`;
	};

	const formatBalance = (balance: number | null) => {
		if (balance === null) return '—';
		return `$${balance.toFixed(4)}`;
	};

	const formatUsdcBalance = (balance: number | null) => {
		if (balance === null) return '—';
		return `${balance.toFixed(2)} USDC`;
	};

	return (
		<div className="w-80 border-l border-border bg-background flex flex-col h-full">
			<div className="h-14 border-b border-border px-4 flex items-center justify-between shrink-0">
				<div className="flex items-center gap-2">
					<Settings className="w-4 h-4" />
					<span className="font-medium">Settings</span>
				</div>
				<Button variant="ghost" size="icon" onClick={collapseSidebar}>
					<ChevronRight className="w-4 h-4" />
				</Button>
			</div>

			<div className="flex-1 overflow-y-auto">
				<SettingsSection
					title="Default Model"
					icon={<Cpu className="w-4 h-4 text-muted-foreground" />}
				>
					<SelectRow
						label="Provider"
						value={config?.defaults?.provider ?? ''}
						options={providerOptions}
						onChange={handleProviderChange}
						disabled={updateDefaults.isPending}
					/>
					<SelectRow
						label="Model"
						value={config?.defaults?.model ?? ''}
						options={modelOptions}
						onChange={handleModelChange}
						disabled={updateDefaults.isPending}
					/>
					<SelectRow
						label="Agent"
						value={config?.defaults?.agent ?? ''}
						options={agentOptions}
						onChange={handleAgentChange}
						disabled={updateDefaults.isPending}
					/>
				</SettingsSection>

				<SettingsSection
					title="Preferences"
					icon={<User className="w-4 h-4 text-muted-foreground" />}
				>
					<ToggleRow
						label="Vim Mode"
						checked={preferences.vimMode}
						onChange={(checked) => updatePreferences({ vimMode: checked })}
					/>
					<ToggleRow
						label="Show Reasoning"
						checked={preferences.reasoningEnabled}
					onChange={(checked) =>
						updatePreferences({ reasoningEnabled: checked })
					}
			/>
			<SelectRow
				label="Tool Approval"
				value={config?.defaults?.toolApproval ?? 'auto'}
				options={[
					{ id: 'auto', label: 'Auto (no approval)' },
					{ id: 'dangerous', label: 'Dangerous only' },
					{ id: 'all', label: 'All tools' },
				]}
				onChange={(value) =>
					updateDefaults.mutate({
						toolApproval: value as 'auto' | 'dangerous' | 'all',
					})
				}
				disabled={updateDefaults.isPending}
			/>
		</SettingsSection>

				{config?.providers?.includes('solforge') && (
					<SettingsSection
						title="Solforge Wallet"
						icon={<Wallet className="w-4 h-4 text-muted-foreground" />}
						action={
							<button
								type="button"
								onClick={refreshSolforgeBalance}
								disabled={solforgeLoading}
								className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
								title="Refresh balances"
							>
								<RefreshCw
									className={`w-3.5 h-3.5 text-muted-foreground ${solforgeLoading ? 'animate-spin' : ''}`}
								/>
							</button>
						}
					>
						{solforgeWallet && (
							<div className="flex justify-center pb-3">
								<div className="p-2 bg-white rounded-lg">
									<QRCodeSVG
										value={solforgeWallet}
										size={120}
										level="M"
										includeMargin={false}
									/>
								</div>
							</div>
						)}
						<SettingRow
							label="Address"
							value={truncateWallet(solforgeWallet)}
						/>
						<SettingRow
							label="Balance"
							value={formatBalance(solforgeBalance)}
						/>
						<SettingRow
							label="USDC"
							value={formatUsdcBalance(solforgeUsdcBalance)}
						/>
					</SettingsSection>
				)}

				<SettingsSection
					title="Providers"
					icon={<Zap className="w-4 h-4 text-muted-foreground" />}
				>
					<div className="flex flex-wrap gap-2">
						{config?.providers?.map((provider) => (
							<span
								key={provider}
								className="px-2 py-1 text-xs bg-muted rounded-md font-mono"
							>
								{provider}
							</span>
						)) ?? <span className="text-muted-foreground text-sm">None</span>}
					</div>
				</SettingsSection>
			</div>
		</div>
	);
});
