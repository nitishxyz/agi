import PKG from './package.json' with { type: 'json' };
import { runCli } from './src/cli.ts';

let argv = process.argv.slice(2);

if (argv[0] === 'agi' || argv[0]?.endsWith('/agi')) {
	argv = argv.slice(1);
}

runCli(argv, (PKG as { version: string }).version);
