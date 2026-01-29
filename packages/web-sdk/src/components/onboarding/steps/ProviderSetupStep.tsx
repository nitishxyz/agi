import { memo, useEffect, useState, useRef } from 'react';
import {
	Copy,
	Check,
	CreditCard,
	Loader2,
	X,
	Key,
	ExternalLink,
	ArrowRight,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ProviderLogo } from '../../common/ProviderLogo';
import type { AuthStatus } from '../../../stores/onboardingStore';
import { useSetuStore } from '../../../stores/setuStore';
import { useSetuBalance } from '../../../hooks/useSetuBalance';

interface ProviderSetupStepProps {
	authStatus: AuthStatus;
	onSetupWallet: () => Promise<unknown>;
	onAddProvider: (provider: string, apiKey: string) => Promise<unknown>;
	onRemoveProvider: (provider: string) => Promise<unknown>;
	onStartOAuth: (provider: string, mode?: string) => Window | null;
	onStartOAuthManual: (
		provider: string,
		mode?: string,
	) => Promise<{ popup: Window | null; sessionId: string }>;
	onExchangeOAuthCode: (
		provider: string,
		code: string,
		sessionId: string,
	) => Promise<boolean>;
	onOpenTopup: () => void;
	onNext: () => void;
	manageMode?: boolean;
	onClose?: () => void;
}

export const ProviderSetupStep = memo(function ProviderSetupStep({
	authStatus,
	onSetupWallet,
	onAddProvider,
	onRemoveProvider,
	onStartOAuth,
	onStartOAuthManual,
	onExchangeOAuthCode,
	onOpenTopup,
	onNext,
	manageMode = false,
	onClose,
}: ProviderSetupStepProps) {
	const [copied, setCopied] = useState(false);
	const [isSettingUp, setIsSettingUp] = useState(false);
	const [addingProvider, setAddingProvider] = useState<string | null>(null);
	const [apiKeyInput, setApiKeyInput] = useState('');
	const [removingProvider, setRemovingProvider] = useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
	const [oauthSession, setOauthSession] = useState<{
		provider: string;
		sessionId: string | null;
		mode?: string;
	} | null>(null);
	const [oauthCodeInput, setOauthCodeInput] = useState('');
	const [isExchangingCode, setIsExchangingCode] = useState(false);
	const [isOpeningPopup, setIsOpeningPopup] = useState(false);
	const balance = useSetuStore((s) => s.balance);
	const usdcBalance = useSetuStore((s) => s.usdcBalance);
	const apiKeyInputRef = useRef<HTMLInputElement>(null);
	const oauthCodeInputRef = useRef<HTMLInputElement>(null);

	useSetuBalance('setu');

	useEffect(() => {
		if (!authStatus.setu.configured && !isSettingUp) {
			setIsSettingUp(true);
			onSetupWallet().finally(() => setIsSettingUp(false));
		}
	}, [authStatus.setu.configured, onSetupWallet, isSettingUp]);

	useEffect(() => {
		if (addingProvider && apiKeyInputRef.current) {
			apiKeyInputRef.current.focus();
		}
	}, [addingProvider]);

	useEffect(() => {
		if (oauthSession && oauthCodeInputRef.current) {
			oauthCodeInputRef.current.focus();
		}
	}, [oauthSession]);

	const handleCopy = async () => {
		if (authStatus.setu.publicKey) {
			await navigator.clipboard.writeText(authStatus.setu.publicKey);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const truncateAddress = (addr: string) =>
		`${addr.slice(0, 8)}...${addr.slice(-6)}`;

	const handleAddProvider = async (providerId: string) => {
		if (!apiKeyInput.trim()) return;
		try {
			await onAddProvider(providerId, apiKeyInput.trim());
			setAddingProvider(null);
			setApiKeyInput('');
		} catch {}
	};

	const handleRemoveProvider = async (providerId: string) => {
		if (confirmingDelete === providerId) {
			setRemovingProvider(providerId);
			try {
				await onRemoveProvider(providerId);
			} finally {
				setRemovingProvider(null);
				setConfirmingDelete(null);
			}
		} else {
			setConfirmingDelete(providerId);
		}
	};

	const handleCancelDelete = () => {
		setConfirmingDelete(null);
	};

	const handleStartOAuth = async (providerId: string, mode?: string) => {
		if (providerId === 'anthropic') {
			setOauthSession({ provider: providerId, sessionId: null, mode });
		} else {
			onStartOAuth(providerId, mode);
		}
	};

	const handleOpenPopup = async () => {
		if (!oauthSession) return;
		setIsOpeningPopup(true);
		try {
			const { sessionId } = await onStartOAuthManual(
				oauthSession.provider,
				oauthSession.mode,
			);
			setOauthSession({ ...oauthSession, sessionId });
		} catch (err) {
			console.error('Failed to start OAuth:', err);
		}
		setIsOpeningPopup(false);
	};

	const handleExchangeCode = async () => {
		if (!oauthSession || !oauthSession.sessionId || !oauthCodeInput.trim())
			return;
		setIsExchangingCode(true);
		try {
			await onExchangeOAuthCode(
				oauthSession.provider,
				oauthCodeInput.trim(),
				oauthSession.sessionId,
			);
			setOauthSession(null);
			setOauthCodeInput('');
		} catch {}
		setIsExchangingCode(false);
	};

	const handleCancelOAuth = () => {
		setOauthSession(null);
		setOauthCodeInput('');
	};

	const configuredProviders = Object.entries(authStatus.providers).filter(
		([id, info]) => info.configured && id !== 'setu',
	);
	const unconfiguredProviders = Object.entries(authStatus.providers).filter(
		([id, info]) => !info.configured && id !== 'setu',
	);

	return (
		<div className="min-h-screen flex flex-col">
			{/* Top Bar */}
			<div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
				<div className="flex items-center gap-3">
					<ProviderLogo provider="setu" size={24} />
					<span className="font-semibold text-foreground">AGI</span>
				</div>
				{!manageMode && (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<span className="w-2 h-2 rounded-full bg-green-500" />
						Step 1 of 2
					</div>
				)}
			</div>

			{/* Main Content */}
			<div className="flex-1 px-4 pt-6 sm:px-6 sm:pt-8 lg:px-12 lg:pt-12 pb-32">
				<div className="max-w-7xl mx-auto">
					{/* Header */}
					<div className="mb-10">
						<h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-foreground mb-3">
							{manageMode ? 'Manage Providers' : 'Welcome to AGI'}
						</h1>
						<p className="text-lg text-muted-foreground max-w-2xl">
							{manageMode
								? 'Add or remove AI providers. Your changes are saved automatically.'
								: "Setu is your default AI provider, powered by your wallet. Add more providers below if you'd like."}
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 xl:gap-8">
					{/* Left Column - Wallet */}
					<div className="md:col-span-1">
						<div className="bg-card rounded-2xl border border-border p-5">
							{authStatus.setu.configured && authStatus.setu.publicKey ? (
									<div className="flex flex-col h-full">
										{/* Setu Default Provider Badge */}
										<div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
											<ProviderLogo provider="setu" size={16} />
											<span className="text-sm font-medium text-green-600 dark:text-green-400">
												Setu
											</span>
											<span className="text-xs text-green-600/60 dark:text-green-500/60 ml-auto">
												Default Provider
											</span>
										</div>

										<div className="flex justify-center py-4 mt-4">
											<div className="bg-white p-2 rounded-lg">
												<QRCodeSVG
													value={authStatus.setu.publicKey}
													size={140}
													level="M"
												/>
											</div>
										</div>

										<div className="space-y-2 mt-4">
											<button
												type="button"
												onClick={handleCopy}
												className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-xs font-mono text-muted-foreground transition-colors"
											>
												{truncateAddress(authStatus.setu.publicKey)}
												{copied ? (
													<Check className="w-3.5 h-3.5 text-green-500" />
												) : (
													<Copy className="w-3.5 h-3.5 text-muted-foreground" />
												)}
											</button>

											<div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg">
												<span className="text-xs text-muted-foreground">
													Balance
												</span>
												<span className="font-mono text-sm text-foreground">
													${((balance ?? 0) + (usdcBalance ?? 0)).toFixed(4)}
												</span>
											</div>
										</div>

										{/* OR Divider */}
										<div className="flex items-center gap-4 py-4">
											<div className="flex-1 h-px bg-border" />
											<span className="text-xs text-muted-foreground font-medium">
												OR
											</span>
											<div className="flex-1 h-px bg-border" />
										</div>

										<button
											type="button"
											onClick={onOpenTopup}
											className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
										>
											<CreditCard className="w-4 h-4" />
											Pay via Card
										</button>
									</div>
								) : (
									<div className="flex items-center justify-center py-16">
										<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
									</div>
								)}
							</div>
						</div>

					{/* Right Column - Providers */}
					<div className="md:col-span-1 xl:col-span-2 space-y-6">
						{/* Connected Providers */}
							<div>
								<div className="flex items-center justify-between mb-4">
									<h2 className="font-semibold text-foreground">
										Connected Providers
									</h2>
									{configuredProviders.length > 0 && (
										<span className="text-sm text-muted-foreground">
											{configuredProviders.length} active
										</span>
									)}
								</div>

								{configuredProviders.length === 0 ? (
									<div className="text-sm text-muted-foreground py-4">
										No providers connected yet. Add one below.
									</div>
								) : (
									<div className="flex flex-wrap gap-2">
										{configuredProviders.map(([id, info]) => (
											<div
												key={id}
												className={`flex items-center gap-2 pl-3 pr-2 py-2 rounded-full transition-all duration-200 ${
													confirmingDelete === id
														? 'bg-destructive/10 border border-destructive/30'
														: 'group bg-green-500/10 border border-green-500/20'
												}`}
											>
												<ProviderLogo provider={id} size={16} />
												<span
													className={`text-sm font-medium transition-colors ${
														confirmingDelete === id
															? 'text-destructive'
															: 'text-green-600 dark:text-green-400'
													}`}
												>
													{info.label}
												</span>
												{confirmingDelete !== id && (
													<span className="text-xs text-green-600/60 dark:text-green-500/60">
														{info.type === 'oauth' ? 'OAuth' : 'API'}
													</span>
												)}
												{confirmingDelete === id ? (
													<div className="flex items-center gap-1 ml-1">
														<span className="text-xs text-destructive/80 mr-1">
															Remove?
														</span>
														<button
															type="button"
															onClick={() => handleRemoveProvider(id)}
															disabled={removingProvider === id}
															className="px-2 py-0.5 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors disabled:opacity-50"
														>
															{removingProvider === id ? (
																<Loader2 className="w-3 h-3 animate-spin" />
															) : (
																'Yes'
															)}
														</button>
														<button
															type="button"
															onClick={handleCancelDelete}
															className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
														>
															No
														</button>
													</div>
												) : (
													id !== 'setu' && (
														<button
															type="button"
															onClick={() => handleRemoveProvider(id)}
															className="ml-1 p-1 text-green-600/40 dark:text-green-500/40 hover:text-green-600/80 dark:hover:text-green-500/80 opacity-0 group-hover:opacity-100 transition-opacity"
														>
															<X className="w-3 h-3" />
														</button>
													)
												)}
											</div>
										))}
									</div>
								)}
							</div>

							{/* Add Providers */}
							<div>
								<h2 className="font-semibold text-foreground mb-4">
									Add Providers
								</h2>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
									{unconfiguredProviders.map(([id, info]) => (
										<div key={id}>
											{addingProvider === id ? (
									<div className="flex items-center gap-2 p-3 bg-card border border-ring rounded-xl overflow-hidden">
										<div className="shrink-0">
											<ProviderLogo provider={id} size={18} />
										</div>
										<input
											ref={apiKeyInputRef}
											type="password"
											value={apiKeyInput}
											onChange={(e) => setApiKeyInput(e.target.value)}
											placeholder={`${info.label} API key...`}
											className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
											onKeyDown={(e) => {
															if (e.key === 'Enter') handleAddProvider(id);
															if (e.key === 'Escape') {
																setAddingProvider(null);
																setApiKeyInput('');
															}
														}}
													/>
										<button
											type="button"
											onClick={() => handleAddProvider(id)}
											disabled={!apiKeyInput.trim()}
											className="shrink-0 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg disabled:opacity-50"
										>
											Add
										</button>
										<button
											type="button"
											onClick={() => {
												setAddingProvider(null);
												setApiKeyInput('');
											}}
											className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground"
										>
											<X className="w-4 h-4" />
										</button>
												</div>
											) : (
									<div className="flex items-center justify-between p-3 bg-card border border-border hover:border-border/80 rounded-xl transition-colors gap-2">
										<div className="flex items-center gap-3 min-w-0">
											<ProviderLogo provider={id} size={20} />
											<div className="min-w-0">
												<div className="font-medium text-foreground truncate">
													{info.label}
												</div>
															<div className="text-xs text-muted-foreground">
																{info.modelCount} models
															</div>
														</div>
													</div>
													<div className="flex items-center gap-1">
														<button
															type="button"
															onClick={() => setAddingProvider(id)}
															className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
														>
															<Key className="w-3.5 h-3.5" />
															API
														</button>
														{info.supportsOAuth && (
															<button
																type="button"
																onClick={() =>
																	handleStartOAuth(
																		id,
																		id === 'anthropic' ? 'max' : undefined,
																	)
																}
																className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
															>
																<ExternalLink className="w-3.5 h-3.5" />
																{id === 'anthropic' ? 'Max' : 'OAuth'}
															</button>
														)}
													</div>
												</div>
											)}
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Bottom Bar */}
			<div className="fixed bottom-0 left-0 right-0 px-4 sm:px-6 py-4 border-t border-border bg-background">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					{!manageMode && (
						<div className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
							You can add more providers later in settings
						</div>
					)}
					{manageMode ? (
						<button
							type="button"
							onClick={onClose}
							className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors ml-auto"
						>
							Done
						</button>
					) : (
						<button
							type="button"
							onClick={onNext}
							className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
						>
							Continue
							<ArrowRight className="w-4 h-4" />
						</button>
					)}
				</div>
			</div>

			{/* OAuth Code Modal */}
			{oauthSession && (
				<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="bg-background border border-border rounded-xl w-full max-w-lg mx-6 shadow-2xl">
						<div className="flex items-center gap-3 p-6 border-b border-border">
							<ProviderLogo provider={oauthSession.provider} size={24} />
							<h3 className="text-lg font-semibold">
								Connect{' '}
								{authStatus.providers[oauthSession.provider]?.label ||
									oauthSession.provider}
							</h3>
						</div>

						{!oauthSession.sessionId ? (
							<div className="p-6">
								<p className="text-sm text-muted-foreground mb-6">
									You'll be redirected to{' '}
									{authStatus.providers[oauthSession.provider]?.label ||
										oauthSession.provider}{' '}
									to authorize access. After authorizing, copy the code and
									return here.
								</p>
								<div className="flex gap-3">
									<button
										type="button"
										onClick={handleCancelOAuth}
										className="flex-1 h-11 px-4 bg-transparent border border-border text-foreground rounded-lg font-medium hover:bg-muted/50 transition-colors"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={handleOpenPopup}
										disabled={isOpeningPopup}
										className="flex-1 h-11 px-4 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
									>
										{isOpeningPopup ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											<>
												Continue
												<ExternalLink className="w-4 h-4" />
											</>
										)}
									</button>
								</div>
							</div>
						) : (
							<div className="p-6">
								<p className="text-sm text-muted-foreground mb-4">
									Paste the authorization code:
								</p>
								<input
									type="text"
									ref={oauthCodeInputRef}
									value={oauthCodeInput}
									onChange={(e) => setOauthCodeInput(e.target.value)}
									placeholder="Paste code here..."
									className="w-full h-11 px-4 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/30 transition-colors mb-4 font-mono text-sm"
									onKeyDown={(e) => {
										if (e.key === 'Enter') handleExchangeCode();
										if (e.key === 'Escape') handleCancelOAuth();
									}}
								/>
								<div className="flex gap-3">
									<button
										type="button"
										onClick={handleCancelOAuth}
										className="flex-1 h-11 px-4 bg-transparent border border-border text-foreground rounded-lg font-medium hover:bg-muted/50 transition-colors"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={handleExchangeCode}
										disabled={!oauthCodeInput.trim() || isExchangingCode}
										className="flex-1 h-11 px-4 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
									>
										{isExchangingCode ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											'Connect'
										)}
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
});
