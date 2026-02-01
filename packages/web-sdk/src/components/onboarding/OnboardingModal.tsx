import { memo } from 'react';
import { ProviderSetupStep } from './steps/ProviderSetupStep';
import { DefaultsStep } from './steps/DefaultsStep';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useSetuStore } from '../../stores/setuStore';
import { useAuthStatus } from '../../hooks/useAuthStatus';

interface OnboardingModalProps {
	hideHeader?: boolean;
}

export const OnboardingModal = memo(function OnboardingModal({
	hideHeader = false,
}: OnboardingModalProps) {
	const isOpen = useOnboardingStore((s) => s.isOpen);
	const currentStep = useOnboardingStore((s) => s.currentStep);
	const manageMode = useOnboardingStore((s) => s.manageMode);
	const authStatus = useOnboardingStore((s) => s.authStatus);
	const nextStep = useOnboardingStore((s) => s.nextStep);
	const prevStep = useOnboardingStore((s) => s.prevStep);
	const reset = useOnboardingStore((s) => s.reset);
	const openTopupModal = useSetuStore((s) => s.openTopupModal);

	const {
		setupWallet,
		addProvider,
		removeProvider,
		completeOnboarding,
		startOAuth,
		startOAuthManual,
		exchangeOAuthCode,
		startCopilotDeviceFlow,
		pollCopilotDeviceFlow,
	} = useAuthStatus();

	if (!isOpen || !authStatus) return null;

	return (
		<div className="fixed inset-0 z-[9999] bg-background text-foreground overflow-y-auto">
			{currentStep === 'wallet' && (
				<ProviderSetupStep
					authStatus={authStatus}
					onSetupWallet={setupWallet}
					onAddProvider={addProvider}
					onRemoveProvider={removeProvider}
					onStartOAuth={startOAuth}
					onStartOAuthManual={startOAuthManual}
					onExchangeOAuthCode={exchangeOAuthCode}
					onOpenTopup={openTopupModal}
					onNext={nextStep}
					manageMode={manageMode}
					onClose={reset}
					hideHeader={hideHeader}
					onStartCopilotDeviceFlow={startCopilotDeviceFlow}
					onPollCopilotDeviceFlow={pollCopilotDeviceFlow}
				/>
			)}

			{currentStep === 'defaults' && (
				<DefaultsStep
					authStatus={authStatus}
					onComplete={completeOnboarding}
					onBack={prevStep}
					hideHeader={hideHeader}
				/>
			)}
		</div>
	);
});
