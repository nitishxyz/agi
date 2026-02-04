import { useEffect } from 'react';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import {
	OnboardingModal,
	SetuTopupModal,
	useAuthStatus,
} from '@ottocode/web-sdk';

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	const { checkOnboarding } = useAuthStatus();

	useEffect(() => {
		checkOnboarding();
	}, [checkOnboarding]);

	return (
		<>
			<Outlet />
			<OnboardingModal />
			<SetuTopupModal />
			{import.meta.env.DEV ? (
				<TanStackRouterDevtools position="bottom-right" />
			) : null}
		</>
	);
}
