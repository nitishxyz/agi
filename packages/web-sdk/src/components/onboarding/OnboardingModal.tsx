import { memo } from 'react';
import { WalletSetupStep } from './steps/WalletSetupStep';
import { DefaultsStep } from './steps/DefaultsStep';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useSetuStore } from '../../stores/setuStore';
import { useAuthStatus } from '../../hooks/useAuthStatus';

export const OnboardingModal = memo(function OnboardingModal() {
	const isOpen = useOnboardingStore((s) => s.isOpen);
	const currentStep = useOnboardingStore((s) => s.currentStep);
	const authStatus = useOnboardingStore((s) => s.authStatus);
	const nextStep = useOnboardingStore((s) => s.nextStep);
	const prevStep = useOnboardingStore((s) => s.prevStep);
	const openTopupModal = useSetuStore((s) => s.openTopupModal);

	const {
		setupWallet,
		addProvider,
		removeProvider,
		completeOnboarding,
		startOAuth,
		startOAuthManual,
		exchangeOAuthCode,
	} = useAuthStatus();

	if (!isOpen || !authStatus) return null;

	return (
		<div className="fixed inset-0 z-[9999] bg-background text-foreground overflow-y-auto">
			{currentStep === 'wallet' && (
				<WalletSetupStep
					authStatus={authStatus}
					onSetupWallet={setupWallet}
					onAddProvider={addProvider}
					onRemoveProvider={removeProvider}
					onStartOAuth={startOAuth}
					onStartOAuthManual={startOAuthManual}
					onExchangeOAuthCode={exchangeOAuthCode}
					onOpenTopup={openTopupModal}
					onNext={nextStep}
				/>
			)}

			{currentStep === 'defaults' && (
				<DefaultsStep
					authStatus={authStatus}
					onComplete={completeOnboarding}
					onBack={prevStep}
				/>
			)}
		</div>
	);
});
