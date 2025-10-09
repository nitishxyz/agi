import { defineConfig } from '@hey-api/openapi-ts';

/**
 * Hey API OpenAPI TypeScript Configuration
 * 
 * Using the latest version (v0.85.x) with Axios client.
 * The legacy client is NOT deprecated - we're using the modern Axios implementation.
 * 
 * Documentation:
 * - Get Started: https://heyapi.dev/openapi-ts/get-started
 * - Axios Client: https://heyapi.dev/openapi-ts/clients/axios
 * - Migrating: https://heyapi.dev/openapi-ts/migrating
 */
export default defineConfig({
	// Input OpenAPI specification
	input: './openapi.json',
	
	// Output configuration
	output: {
		path: './src/generated',
		// Format the output with prettier (set to null to disable)
		format: null,
		// Lint the output (set to null to disable)
		lint: null,
	},
	
	// Plugins to generate artifacts
	plugins: [
		// Generate TypeScript types
		{
			name: '@hey-api/typescript',
			// Generate enums as TypeScript enums (not const objects)
			enums: 'typescript',
		},
		
		// Generate runtime schemas (for validation if needed)
		'@hey-api/schemas',
		
		// Generate SDK functions
		{
			name: '@hey-api/sdk',
			// Use tree-shakeable function exports (not classes)
			asClass: false,
		},
		
		// Use Axios client
		{
			name: '@hey-api/client-axios',
			// Runtime config path for custom client configuration
			// Path is relative to the generated output directory
			runtimeConfigPath: '../runtime-config',
		},
	],
});
