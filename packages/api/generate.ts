#!/usr/bin/env bun
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

console.log('🔧 Generating OpenAPI spec from server...\\n');

// Ask the server app for its OpenAPI document so SDK generation follows the
// runtime API surface instead of importing spec internals directly.
const { createApp } = await import('../server/src/index.ts');

const response = await createApp().request('/openapi.json');
if (!response.ok) {
	console.error(`❌ Failed to load OpenAPI spec: ${response.status}`);
	process.exit(1);
}

const spec = await response.json();

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
console.log('   import { client } from "@ottocode/api";');
console.log('   client.setConfig({ baseURL: "http://localhost:3000" });');

// Importing the server app can initialize long-lived runtime resources. Codegen
// is a one-shot command, so terminate explicitly once files are written.
process.exit(0);
