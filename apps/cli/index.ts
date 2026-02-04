// Side-effect import to suppress bigint-buffer warning - must be first
import './src/suppress-warnings.ts';

import { bootstrapBinaries } from './src/bootstrap-bins.ts';
import PKG from './package.json' with { type: 'json' };
import { runCli } from './src/cli.ts';

bootstrapBinaries();

let argv = process.argv.slice(2);

if (argv[0] === 'otto' || argv[0]?.endsWith('/otto')) {
	argv = argv.slice(1);
}

runCli(argv, (PKG as { version: string }).version)
	.then(() => process.exit(0))
	.catch(() => process.exit(1));
