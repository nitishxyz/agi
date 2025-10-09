#!/usr/bin/env bun
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

console.log('🔧 Generating OpenAPI spec from server...\\n');

// Import the spec generator from the server package
const { getOpenAPISpec } = await import('../server/src/openapi/spec.ts');

const spec = getOpenAPISpec();

// Write spec to file for @hey-api/openapi-ts
const specPath = join(import.meta.dir, 'openapi.json');
writeFileSync(specPath, JSON.stringify(spec, null, 2));

console.log('✅ Generated OpenAPI spec:', specPath);
console.log('\\n📦 Running @hey-api/openapi-ts codegen...\\n');

// Run hey-api codegen using the configuration file
// The configuration is in openapi-ts.config.ts
const codegen = Bun.spawnSync(
	[
		'bunx',
		'@hey-api/openapi-ts',
		// The config file will be automatically detected
		// No need to pass --input, --output, or --client flags
	],
	{
		cwd: import.meta.dir,
		stdout: 'inherit',
		stderr: 'inherit',
	},
);

if (!codegen.success) {
	console.error('❌ Failed to generate client');
	process.exit(1);
}

console.log('\\n✅ Client generation complete!');
console.log(
	'\\n📝 Note: The client uses Axios. Make sure to configure the baseURL when using the client:',
);
console.log('   import { client } from "@agi-cli/api";');
console.log('   client.setConfig({ baseURL: "http://localhost:3000" });');
