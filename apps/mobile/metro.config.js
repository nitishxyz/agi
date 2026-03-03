// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `find-yarn-workspace-root`
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo and the local package
config.watchFolders = [
	path.resolve(monorepoRoot, 'apps', 'mobile'),
	// Add other specific packages you import
];
// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
	path.resolve(projectRoot, 'node_modules'),
	path.resolve(monorepoRoot, 'node_modules'),
];

// Custom resolver for handling package exports compatibility
const resolveRequestWithPackageExports = (context, moduleName, platform) => {
	// Package exports in `isows` (a `viem`) dependency are incompatible, so they need to be disabled
	if (moduleName === 'isows') {
		const ctx = {
			...context,
			unstable_enablePackageExports: false,
		};
		return ctx.resolveRequest(ctx, moduleName, platform);
	}

	// Package exports in `zustand@4` are incompatible, so they need to be disabled
	if (moduleName.startsWith('zustand')) {
		const ctx = {
			...context,
			unstable_enablePackageExports: false,
		};
		return ctx.resolveRequest(ctx, moduleName, platform);
	}

	// Package exports in `uuid` cause issues - force browser condition
	if (moduleName === 'uuid' || moduleName.startsWith('uuid/')) {
		const ctx = {
			...context,
			unstable_enablePackageExports: false,
		};
		return ctx.resolveRequest(ctx, moduleName, platform);
	}

	return context.resolveRequest(context, moduleName, platform);
};

// Add custom configuration for ESM packages
config.resolver = {
	...config.resolver,
	sourceExts: [...config.resolver.sourceExts, 'mjs', 'cjs', 'sql'],
	// Alias Node.js built-in modules to polyfills for React Native
	extraNodeModules: {
		...config.resolver.extraNodeModules,
		crypto: path.resolve(projectRoot, 'polyfills/crypto.js'),
	},
	resolveRequest: resolveRequestWithPackageExports,
};

module.exports = config;
