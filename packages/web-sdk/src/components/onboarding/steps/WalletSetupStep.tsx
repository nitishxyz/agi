import { memo, useEffect, useState } from 'react';
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

interface WalletSetupStepProps {
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
}

export const WalletSetupStep = memo(function WalletSetupStep({
	authStatus,
	onSetupWallet,
	onAddProvider,
	onRemoveProvider,
	onStartOAuth,
	onStartOAuthManual,
	onExchangeOAuthCode,
	onOpenTopup,
	onNext,
}: WalletSetupStepProps) {
	const [copied, setCopied] = useState(false);
	const [isSettingUp, setIsSettingUp] = useState(false);
	const [addingProvider, setAddingProvider] = useState<string | null>(null);
	const [apiKeyInput, setApiKeyInput] = useState('');
	const [removingProvider, setRemovingProvider] = useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
	const [oauthSession, setOauthSession] = useState<{
		provider: string;
		sessionId: string;
	} | null>(null);
	const [oauthCodeInput, setOauthCodeInput] = useState('');
	const [isExchangingCode, setIsExchangingCode] = useState(false);
	const balance = useSetuStore((s) => s.balance);

	useSetuBalance('setu');

	useEffect(() => {
		if (!authStatus.setu.configured && !isSettingUp) {
			setIsSettingUp(true);
			onSetupWallet().finally(() => setIsSettingUp(false));
		}
	}, [authStatus.setu.configured, onSetupWallet, isSettingUp]);

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
			// User confirmed, proceed with deletion
			setRemovingProvider(providerId);
			try {
				await onRemoveProvider(providerId);
			} finally {
				setRemovingProvider(null);
				setConfirmingDelete(null);
			}
		} else {
			// First click, show confirmation
			setConfirmingDelete(providerId);
		}
	};

	const handleCancelDelete = () => {
		setConfirmingDelete(null);
	};

	const handleStartOAuth = async (providerId: string, mode?: string) => {
		if (providerId === 'anthropic') {
			try {
				const { sessionId } = await onStartOAuthManual(providerId, mode);
				setOauthSession({ provider: providerId, sessionId });
			} catch (err) {
				console.error('Failed to start OAuth:', err);
			}
		} else {
			onStartOAuth(providerId, mode);
		}
	};

	const handleExchangeCode = async () => {
		if (!oauthSession || !oauthCodeInput.trim()) return;
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
			<div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50">
				<div className="flex items-center gap-3">
					<ProviderLogo provider="setu" size={24} />
					<span className="font-semibold text-white">AGI</span>
				</div>
				<div className="flex items-center gap-2 text-sm text-gray-500">
					<span className="w-2 h-2 rounded-full bg-green-500" />
					Step 1 of 2
				</div>
			</div>

			{/* Main Content */}
			<div className="flex-1 px-6 py-8 lg:px-12 lg:py-12">
				<div className="max-w-7xl mx-auto">
					{/* Header */}
					<div className="mb-10">
						<h1 className="text-3xl lg:text-4xl font-semibold text-white mb-3">
							Welcome to AGI
						</h1>
						<p className="text-lg text-gray-400 max-w-2xl">
							Setu is your default AI provider, powered by your wallet. Add more
							providers below if you'd like.
						</p>
					</div>

					<div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
						{/* Left Column - Wallet */}
						<div className="xl:col-span-1">
							<div className="bg-[#111113] rounded-2xl border border-gray-800/50 p-5">
								{authStatus.setu.configured && authStatus.setu.publicKey ? (
									<div className="space-y-4">
										{/* Setu Default Provider Badge */}
										<div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
											<ProviderLogo provider="setu" size={16} />
											<span className="text-sm font-medium text-green-400">
												Setu
											</span>
											<span className="text-xs text-green-500/60 ml-auto">
												Default Provider
											</span>
										</div>

										<div className="flex justify-center py-2">
											<div className="bg-white p-2 rounded-lg">
												<QRCodeSVG
													value={authStatus.setu.publicKey}
													size={140}
													level="M"
												/>
											</div>
										</div>

										<div className="space-y-2">
											<button
												type="button"
												onClick={handleCopy}
												className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-800 rounded-lg text-xs font-mono text-gray-300 transition-colors"
											>
												{truncateAddress(authStatus.setu.publicKey)}
												{copied ? (
													<Check className="w-3.5 h-3.5 text-green-500" />
												) : (
													<Copy className="w-3.5 h-3.5 text-gray-500" />
												)}
											</button>

											<div className="flex items-center justify-between px-3 py-2 bg-gray-800/30 rounded-lg">
												<span className="text-xs text-gray-500">Balance</span>
												<span className="font-mono text-sm text-white">
													${balance?.toFixed(4) ?? '0.0000'} USDC
												</span>
											</div>
										</div>

										<button
											type="button"
											onClick={onOpenTopup}
											className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
										>
											<CreditCard className="w-4 h-4" />
											Add Funds
										</button>
									</div>
								) : (
									<div className="flex items-center justify-center py-16">
										<Loader2 className="w-8 h-8 animate-spin text-gray-600" />
									</div>
								)}
							</div>
						</div>

						{/* Right Column - Providers */}
						<div className="xl:col-span-2 space-y-6">
							{/* Connected Providers */}
							<div>
								<div className="flex items-center justify-between mb-4">
									<h2 className="font-semibold text-white">
										Connected Providers
									</h2>
									{configuredProviders.length > 0 && (
										<span className="text-sm text-gray-500">
											{configuredProviders.length} active
										</span>
									)}
								</div>

								{configuredProviders.length === 0 ? (
									<div className="text-sm text-gray-500 py-4">
										No providers connected yet. Add one below.
									</div>
								) : (
									<div className="flex flex-wrap gap-2">
										{configuredProviders.map(([id, info]) => (
											<div
												key={id}
												className={`flex items-center gap-2 pl-3 pr-2 py-2 rounded-full transition-all duration-200 ${
													confirmingDelete === id
														? 'bg-red-500/10 border border-red-500/30'
														: 'group bg-green-500/10 border border-green-500/20'
												}`}
											>
												<ProviderLogo provider={id} size={16} />
												<span
													className={`text-sm font-medium transition-colors ${
														confirmingDelete === id
															? 'text-red-400'
															: 'text-green-400'
													}`}
												>
													{info.label}
												</span>
												{confirmingDelete !== id && (
													<span className="text-xs text-green-500/60">
														{info.type === 'oauth' ? 'OAuth' : 'API'}
													</span>
												)}
												{confirmingDelete === id ? (
													<div className="flex items-center gap-1 ml-1">
														<span className="text-xs text-red-400/80 mr-1">
															Remove?
														</span>
														<button
															type="button"
															onClick={() => handleRemoveProvider(id)}
															disabled={removingProvider === id}
															className="px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50"
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
															className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
														>
															No
														</button>
													</div>
												) : (
													id !== 'setu' && (
														<button
															type="button"
															onClick={() => handleRemoveProvider(id)}
															className="ml-1 p-1 text-green-500/40 hover:text-green-500/80 opacity-0 group-hover:opacity-100 transition-opacity"
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

							{/* OAuth Code Entry */}
							{oauthSession && (
								<div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
									<h3 className="font-medium text-white mb-2">
										Enter Authorization Code
									</h3>
									<p className="text-sm text-gray-400 mb-3">
										Copy the code from the authorization page and paste it
										below:
									</p>
									<div className="flex items-center gap-2">
										<input
											type="text"
											value={oauthCodeInput}
											onChange={(e) => setOauthCodeInput(e.target.value)}
											placeholder="Paste authorization code..."
											className="flex-1 px-3 py-2 bg-[#111113] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 outline-none focus:border-blue-500 transition-colors"
											onKeyDown={(e) => {
												if (e.key === 'Enter') handleExchangeCode();
												if (e.key === 'Escape') handleCancelOAuth();
											}}
										/>
										<button
											type="button"
											onClick={handleExchangeCode}
											disabled={!oauthCodeInput.trim() || isExchangingCode}
											className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
										>
											{isExchangingCode ? (
												<Loader2 className="w-4 h-4 animate-spin" />
											) : (
												'Connect'
											)}
										</button>
										<button
											type="button"
											onClick={handleCancelOAuth}
											className="px-3 py-2 text-gray-400 hover:text-white transition-colors"
										>
											<X className="w-4 h-4" />
										</button>
									</div>
								</div>
							)}

							{/* Add Providers */}
							<div>
								<h2 className="font-semibold text-white mb-4">Add Providers</h2>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{unconfiguredProviders.map(([id, info]) => (
										<div key={id}>
											{addingProvider === id ? (
												<div className="flex items-center gap-2 p-3 bg-[#161618] border border-blue-500/30 rounded-xl">
													<ProviderLogo provider={id} size={18} />
													<input
														type="password"
														value={apiKeyInput}
														onChange={(e) => setApiKeyInput(e.target.value)}
														placeholder={`${info.label} API key...`}
														className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-600 text-white"
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
														className="px-3 py-1.5 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-50"
													>
														Add
													</button>
													<button
														type="button"
														onClick={() => {
															setAddingProvider(null);
															setApiKeyInput('');
														}}
														className="p-1.5 text-gray-500 hover:text-gray-300"
													>
														<X className="w-4 h-4" />
													</button>
												</div>
											) : (
												<div className="flex items-center justify-between p-3 bg-[#111113] border border-gray-800/50 hover:border-gray-700 rounded-xl transition-colors">
													<div className="flex items-center gap-3">
														<ProviderLogo provider={id} size={20} />
														<div>
															<div className="font-medium text-white">
																{info.label}
															</div>
															<div className="text-xs text-gray-500">
																{info.modelCount} models
															</div>
														</div>
													</div>
													<div className="flex items-center gap-1">
														<button
															type="button"
															onClick={() => setAddingProvider(id)}
															className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
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
																className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
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
			<div className="px-6 py-4 border-t border-gray-800/50">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					<div className="text-sm text-gray-500">
						You can add more providers later in settings
					</div>
					<button
						type="button"
						onClick={onNext}
						className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors"
					>
						Continue
						<ArrowRight className="w-4 h-4" />
					</button>
				</div>
			</div>
		</div>
	);
});
