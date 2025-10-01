#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

// Skip if running in a workspace (local development)
function isInWorkspace() {
	const __dirname = dirname(fileURLToPath(import.meta.url));
	// Check if we're in a monorepo workspace by looking for workspace root indicators
	const workspaceRoot = resolve(__dirname, '../../');
	return (
		existsSync(resolve(workspaceRoot, 'apps')) &&
		existsSync(resolve(workspaceRoot, 'packages'))
	);
}

async function install() {
	if (isInWorkspace()) {
		console.log('Detected workspace environment, skipping install script.');
		return;
	}

	console.log('Installing agi CLI...');
	console.log('Running: curl -fsSL https://install.agi.nitish.sh | sh');

	try {
		const { stdout, stderr } = await execAsync(
			'curl -fsSL https://install.agi.nitish.sh | sh',
		);
		if (stdout) console.log(stdout);
		if (stderr) console.error(stderr);
		console.log('\n✓ agi CLI installed successfully!');
		console.log('Run "agi --help" to get started.');
	} catch (error) {
		console.error('Failed to install agi CLI:', error.message);
		console.error('\nPlease try installing manually:');
		console.error('  curl -fsSL https://install.agi.nitish.sh | sh');
		process.exit(1);
	}
}

install();
