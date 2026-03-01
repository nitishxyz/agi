import { memo, useState, useMemo, useCallback } from 'react';
import {
	Settings,
	ChevronRight,
	Wallet,
	Cpu,
	Zap,
	User,
	ChevronDown,
	RefreshCw,
	Plus,
	Pencil,
	Copy,
	Check,
	Key,
	Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../ui/Button';
import { useSettingsStore } from '../../stores/settingsStore';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStatus } from '../../hooks/useAuthStatus';
import {
	useConfig,
	useAllModels,
	useUpdateDefaults,
} from '../../hooks/useConfig';
import { usePreferences } from '../../hooks/usePreferences';
import { useSetuStore } from '../../stores/setuStore';
import { SetuTopupModal } from './SetuTopupModal';
import { useSetuBalance } from '../../hooks/useSetuBalance';
import { useTopupCallback } from '../../hooks/useTopupCallback';
import { usePanelWidthStore } from '../../stores/panelWidthStore';
import { ResizeHandle } from '../ui/ResizeHandle';
import { apiClient } from '../../lib/api-client';

const SETTINGS_PANEL_KEY = 'settings';
const SETTINGS_DEFAULT_WIDTH = 320;
const SETTINGS_MIN_WIDTH = 320;
const SETTINGS_MAX_WIDTH = 500;

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
						{/* biome-ignore lint/a11y/noStaticElementInteractions: click-away backdrop pattern */}
						<div
							className="fixed inset-0 z-40"
							onClick={() => setIsOpen(false)}
							role="presentation"
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
	const panelWidth = usePanelWidthStore(
		(s) => s.widths[SETTINGS_PANEL_KEY] ?? SETTINGS_DEFAULT_WIDTH,
	);

	const { data: config } = useConfig();
	const { data: allModels } = useAllModels();
	const { preferences, updatePreferences } = usePreferences();
	const updateDefaults = useUpdateDefaults();
	const setuBalance = useSetuStore((s) => s.balance);
	const setuWallet = useSetuStore((s) => s.walletAddress);
	const setuUsdcBalance = useSetuStore((s) => s.usdcBalance);
	const setuLoading = useSetuStore((s) => s.isLoading);
	const openTopupModal = useSetuStore((s) => s.openTopupModal);

	// Handle topup success callback from Polar checkout redirect
	useTopupCallback();

	const hasSetu = config?.providers?.includes('setu');
	const { fetchBalance: refreshSetuBalance } = useSetuBalance(
		hasSetu ? 'setu' : undefined,
	);

	const setOnboardingOpen = useOnboardingStore((s) => s.setOpen);
	const setStep = useOnboardingStore((s) => s.setStep);
	const setManageMode = useOnboardingStore((s) => s.setManageMode);
	const { fetchAuthStatus } = useAuthStatus();

	const exportSetuPrivateKey = useCallback(async () => {
		return await apiClient.exportSetuWallet();
	}, []);

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
			scope: 'global',
		});
	};

	const handleModelChange = (model: string) => {
		updateDefaults.mutate({ model, scope: 'global' });
	};

	const handleAgentChange = (agent: string) => {
		updateDefaults.mutate({ agent, scope: 'global' });
	};

	return (
		<div
			className="border-l border-border bg-background flex h-full relative"
			style={{ width: panelWidth }}
		>
			<ResizeHandle
				panelKey={SETTINGS_PANEL_KEY}
				side="right"
				minWidth={SETTINGS_MIN_WIDTH}
				maxWidth={SETTINGS_MAX_WIDTH}
				defaultWidth={SETTINGS_DEFAULT_WIDTH}
			/>
			<div className="flex-1 flex flex-col h-full min-w-0">
				<div className="h-14 border-b border-border px-3 flex items-center justify-between shrink-0">
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
							value={config?.defaults?.toolApproval ?? 'dangerous'}
							options={[
								{ id: 'auto', label: 'Auto (no approval)' },
								{ id: 'dangerous', label: 'Dangerous only' },
								{ id: 'all', label: 'All tools' },
							]}
							onChange={(value) =>
								updateDefaults.mutate({
									toolApproval: value as 'auto' | 'dangerous' | 'all',
									scope: 'global',
								})
							}
							disabled={updateDefaults.isPending}
						/>
						<ToggleRow
							label="Guided Mode"
							checked={config?.defaults?.guidedMode ?? false}
							onChange={(checked) =>
								updateDefaults.mutate({
									guidedMode: checked,
									scope: 'global',
								})
							}
						/>
					</SettingsSection>

					<SettingsSection
						title="Providers"
						icon={<Zap className="w-4 h-4 text-muted-foreground" />}
						action={
							<button
								type="button"
								onClick={() => {
									fetchAuthStatus().then(() => {
										setStep('wallet');
										setManageMode(true);
										setOnboardingOpen(true);
									});
								}}
								className="p-1 hover:bg-muted rounded transition-colors"
								title="Manage providers"
							>
								<Pencil className="w-3.5 h-3.5 text-muted-foreground" />
							</button>
						}
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

					{config?.providers?.includes('setu') && (
						<SetuWalletSection
							setuWallet={setuWallet}
							setuBalance={setuBalance}
							setuUsdcBalance={setuUsdcBalance}
							setuLoading={setuLoading}
							refreshSetuBalance={refreshSetuBalance}
							openTopupModal={openTopupModal}
							onExportPrivateKey={exportSetuPrivateKey}
						/>
					)}

					<SetuTopupModal />
				</div>
			</div>
		</div>
	);
});

function SetuSubscriptionInfo() {
	const subscription = useSetuStore((s) => s.subscription);
	const payg = useSetuStore((s) => s.payg);
	const scope = useSetuStore((s) => s.scope);

	if (!subscription?.active && !payg) return null;

	const formatCredits = (value: number) => {
		if (value >= 10) return Math.floor(value).toString();
		if (value >= 1) return value.toFixed(1);
		return value.toFixed(2);
	};

	return (
		<>
			{subscription?.active && (
				<>
					<SettingRow
						label="Plan"
						value={subscription.tierName ?? 'Subscription'}
					/>
					{subscription.creditsIncluded !== undefined &&
						subscription.creditsUsed !== undefined && (
							<div className="space-y-1">
								<SettingRow
									label="Used"
									value={`${formatCredits(subscription.creditsUsed)} / ${formatCredits(subscription.creditsIncluded)}`}
								/>
								<div className="w-full bg-muted rounded-full h-1.5">
									<div
										className="bg-emerald-500 h-1.5 rounded-full transition-all"
										style={{
											width: `${Math.min(100, ((subscription.creditsUsed / subscription.creditsIncluded) * 100))}%`,
										}}
									/>
								</div>
							</div>
						)}
					{subscription.periodEnd && (
						<SettingRow
							label="Renews"
							value={new Date(subscription.periodEnd).toLocaleDateString()}
						/>
					)}
				</>
			)}
			{payg && scope === 'account' && (payg.walletBalanceUsd > 0 || payg.accountBalanceUsd > 0) && (
				<SettingRow
					label="PAYG Balance"
					value={`$${payg.effectiveSpendableUsd.toFixed(4)}`}
				/>
			)}
		</>
	);
}

interface SetuWalletSectionProps {
	setuWallet: string | null;
	setuBalance: number | null;
	setuUsdcBalance: number | null;
	setuLoading: boolean;
	refreshSetuBalance: () => void;
	openTopupModal: () => void;
	onExportPrivateKey: () => Promise<{
		success: boolean;
		publicKey: string;
		privateKey: string;
	}>;
}

const SetuWalletSection = memo(function SetuWalletSection({
	setuWallet,
	setuBalance,
	setuUsdcBalance,
	setuLoading,
	refreshSetuBalance,
	openTopupModal,
	onExportPrivateKey,
}: SetuWalletSectionProps) {
	const hasActiveSubscription = useSetuStore((s) => !!s.subscription?.active);
	const [copied, setCopied] = useState(false);
	const [isExportModalOpen, setIsExportModalOpen] = useState(false);
	const [exportPrivateKey, setExportPrivateKey] = useState<string | null>(null);
	const [isExportingPrivateKey, setIsExportingPrivateKey] = useState(false);
	const [exportPrivateKeyError, setExportPrivateKeyError] = useState<
		string | null
	>(null);
	const [privateKeyCopied, setPrivateKeyCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		if (!setuWallet) return;
		await navigator.clipboard.writeText(setuWallet);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [setuWallet]);

	const handleOpenExportPrivateKey = async () => {
		setIsExportModalOpen(true);
		setPrivateKeyCopied(false);
		setExportPrivateKey(null);
		setExportPrivateKeyError(null);
		setIsExportingPrivateKey(true);
		try {
			const result = await onExportPrivateKey();
			setExportPrivateKey(result.privateKey);
		} catch (err) {
			setExportPrivateKeyError(
				err instanceof Error ? err.message : 'Failed to export private key',
			);
		} finally {
			setIsExportingPrivateKey(false);
		}
	};

	const handleCloseExportPrivateKey = () => {
		if (isExportingPrivateKey) return;
		setIsExportModalOpen(false);
		setPrivateKeyCopied(false);
		setExportPrivateKey(null);
		setExportPrivateKeyError(null);
	};

	const handleCopyPrivateKey = async () => {
		if (!exportPrivateKey) return;
		await navigator.clipboard.writeText(exportPrivateKey);
		setPrivateKeyCopied(true);
		setTimeout(() => setPrivateKeyCopied(false), 2000);
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

	const isLoaded = setuWallet !== null;

	return (
		<SettingsSection
			title="Setu Credits"
			icon={<Wallet className="w-4 h-4 text-muted-foreground" />}
			action={
				<button
					type="button"
					onClick={refreshSetuBalance}
					disabled={setuLoading}
					className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
					title="Refresh balances"
				>
					<RefreshCw
						className={`w-3.5 h-3.5 text-muted-foreground ${setuLoading ? 'animate-spin' : ''}`}
					/>
				</button>
			}
		>
			{isLoaded ? (
				<>
					<div className="flex justify-center pb-3">
						<div className="p-2 bg-white rounded-lg">
							<QRCodeSVG
								value={setuWallet}
								size={120}
								level="M"
								includeMargin={false}
							/>
						</div>
					</div>
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Address</span>
						<button
							type="button"
							onClick={handleCopy}
							className="flex items-center gap-1.5 font-mono text-foreground hover:text-muted-foreground transition-colors"
							title="Copy address"
						>
							{truncateWallet(setuWallet)}
							{copied ? (
								<Check className="w-3 h-3 text-green-500" />
							) : (
								<Copy className="w-3 h-3 text-muted-foreground" />
							)}
						</button>
					</div>
				<SetuSubscriptionInfo />
				{!hasActiveSubscription && (
					<>
						<SettingRow label="Balance" value={formatBalance(setuBalance)} />
						<SettingRow label="USDC" value={formatUsdcBalance(setuUsdcBalance)} />
					</>
				)}
			</>
			) : (
				<>
					<div className="flex justify-center pb-3">
						<div className="w-[136px] h-[136px] bg-muted rounded-lg animate-pulse" />
					</div>
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Address</span>
						<div className="w-24 h-4 bg-muted rounded animate-pulse" />
					</div>
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Balance</span>
						<div className="w-16 h-4 bg-muted rounded animate-pulse" />
					</div>
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">USDC</span>
						<div className="w-20 h-4 bg-muted rounded animate-pulse" />
					</div>
				</>
			)}
			<Button
				variant="secondary"
				size="sm"
				onClick={openTopupModal}
				className="w-full mt-2 gap-2"
			>
				<Plus className="w-4 h-4" />
				Top Up Balance
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onClick={handleOpenExportPrivateKey}
				className="w-full gap-2"
			>
				<Key className="w-4 h-4" />
				Export Private Key
			</Button>

			{isExportModalOpen && (
				<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="bg-background border border-border rounded-xl w-full max-w-lg mx-6 shadow-2xl">
						<div className="flex items-center gap-3 p-6 border-b border-border">
							<Key className="w-5 h-5 text-muted-foreground" />
							<h3 className="text-lg font-semibold">Export Setu Private Key</h3>
						</div>
						<div className="p-6">
							<p className="text-sm text-muted-foreground mb-4">
								Keep this private key secret. Anyone with this key can spend
								funds from your Setu wallet.
							</p>

							{isExportingPrivateKey && (
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Loader2 className="w-4 h-4 animate-spin" />
									Exporting private key...
								</div>
							)}

							{!isExportingPrivateKey && exportPrivateKey && (
								<div className="space-y-3">
									<textarea
										readOnly
										value={exportPrivateKey}
										className="w-full min-h-[110px] px-4 py-3 bg-muted/50 border border-border rounded-lg text-foreground outline-none font-mono text-xs resize-y"
									/>
									<Button
										variant="secondary"
										size="sm"
										onClick={handleCopyPrivateKey}
										className="w-full gap-2"
									>
										{privateKeyCopied ? (
											<Check className="w-4 h-4 text-green-500" />
										) : (
											<Copy className="w-4 h-4" />
										)}
										{privateKeyCopied ? 'Copied' : 'Copy Private Key'}
									</Button>
								</div>
							)}

							{!isExportingPrivateKey && exportPrivateKeyError && (
								<p className="text-sm text-red-500 mt-3">
									{exportPrivateKeyError}
								</p>
							)}
							<div className="flex gap-3 mt-5">
								<button
									type="button"
									onClick={handleCloseExportPrivateKey}
									disabled={isExportingPrivateKey}
									className="flex-1 h-11 px-4 bg-transparent border border-border text-foreground rounded-lg font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
								>
									Close
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</SettingsSection>
	);
});
