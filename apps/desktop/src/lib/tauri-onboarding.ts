import { invoke } from '@tauri-apps/api/core';

export interface OnboardingStatus {
	onboardingComplete: boolean;
	setu: { configured: boolean; publicKey?: string };
	providers: Record<
		string,
		{
			configured: boolean;
			type?: string;
			label: string;
			supportsOAuth: boolean;
			modelCount: number;
		}
	>;
	defaults: {
		agent?: string;
		provider?: string;
		model?: string;
		toolApproval?: string;
	};
}

export const tauriOnboarding = {
	getStatus: () => invoke<OnboardingStatus>('get_onboarding_status'),
	getHomeDirectory: () => invoke<string>('get_home_directory'),
};
