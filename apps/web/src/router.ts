import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

const getBasePath = () => {
	const injectedBasePath =
		typeof globalThis !== 'undefined'
			? (globalThis as { OTTO_ROUTER_BASEPATH?: string }).OTTO_ROUTER_BASEPATH
			: undefined;
	const fallback =
		typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/';
	const value = injectedBasePath ?? fallback ?? '/';
	if (!value) {
		return '/';
	}
	if (value === '/') {
		return '/';
	}
	const withoutTrailingSlash = value.replace(/\/+$/, '') || '/';
	const withLeadingSlash = withoutTrailingSlash.startsWith('/');
	return withLeadingSlash ? withoutTrailingSlash : `/${withoutTrailingSlash}`;
};

export const router = createRouter({
	routeTree,
	basepath: getBasePath(),
});

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}
