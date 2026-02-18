import type { Command } from 'commander';
import { log } from '@clack/prompts';
import qrcode from 'qrcode-terminal';
import { box, colors } from '../ui.ts';
import {
	loadConfig,
	getAuth,
	fetchSetuBalance,
	getPublicKeyFromPrivate,
	fetchSolanaUsdcBalance,
} from '@ottocode/sdk';

const DEFAULT_SETU_URL = 'https://api.setu.ottocode.io';
const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';

function detectNetwork(rpcUrl: string): 'mainnet' | 'devnet' | 'unknown' {
	if (rpcUrl.includes('devnet')) return 'devnet';
	if (rpcUrl.includes('mainnet')) return 'mainnet';
	if (rpcUrl.includes('api.mainnet-beta')) return 'mainnet';
	return 'unknown';
}

export function registerSetuCommand(program: Command) {
	program
		.command('setu')
		.description('Manage Setu wallet and view balance')
		.option('--login', 'Login/setup Setu wallet')
		.action(async (options) => {
			const { runAuth } = await import('../auth.ts');

			if (options.login) {
				await runAuth(['login', 'setu']);
				return;
			}

			console.log('');
			console.log(colors.bold('  Setu Wallet'));
			console.log('');

			const cfg = await loadConfig(process.cwd());
			const auth = await getAuth('setu', cfg.projectRoot);

			if (!auth || auth.type !== 'wallet') {
				log.warn('No Setu wallet configured.');
				console.log(
					`  Run ${colors.cyan('otto setu --login')} to setup your wallet.`,
				);
				console.log(
					`  Or set ${colors.cyan('SETU_PRIVATE_KEY')} environment variable.`,
				);
				console.log('');
				return;
			}

			const privateKey = auth.secret;
			const publicKey = getPublicKeyFromPrivate(privateKey);

			if (!publicKey) {
				log.error('Invalid wallet configuration. Please re-authenticate.');
				console.log('');
				return;
			}

			const rpcUrl =
				process.env.SETU_SOLANA_RPC_URL ||
				process.env.SOLANA_RPC_URL ||
				DEFAULT_RPC_URL;
			const network = detectNetwork(rpcUrl);
			const setuUrl = process.env.SETU_BASE_URL || DEFAULT_SETU_URL;

			const networkLabel =
				network === 'mainnet'
					? colors.green('mainnet')
					: network === 'devnet'
						? colors.yellow('devnet')
						: colors.dim('unknown');

			const walletLines = [
				`Public Key: ${colors.cyan(publicKey)}`,
				`Network:    ${networkLabel}`,
				`RPC:        ${colors.dim(rpcUrl)}`,
				`Setu:   ${colors.dim(setuUrl)}`,
			];

			box('Wallet', walletLines);

			console.log(colors.bold('  Wallet QR Code'));
			console.log('');
			qrcode.generate(publicKey, { small: true }, (qr: string) => {
				console.log(qr);
			});

			console.log(colors.dim('  Fetching balances...'));
			const [balanceData, usdcResult] = await Promise.all([
				fetchSetuBalance({ privateKey }, setuUrl),
				fetchSolanaUsdcBalance(
					{ privateKey },
					network === 'devnet' ? 'devnet' : 'mainnet',
				),
			]);

			if (usdcResult) {
				console.log(
					`  USDC:     ${colors.green(`${usdcResult.usdcBalance.toFixed(2)} USDC`)}`,
				);
			} else {
				console.log(`  USDC:     ${colors.dim('Could not fetch')}`);
			}

			if (balanceData) {
				box('Setu Account', [
					`Balance:      ${colors.green(`$${balanceData.balance.toFixed(4)}`)}`,
					`Total Spent:  ${colors.dim(`$${balanceData.totalSpent.toFixed(4)}`)}`,
					`Total Topups: ${colors.dim(`$${balanceData.totalTopups.toFixed(4)}`)}`,
					`Requests:     ${colors.dim(balanceData.requestCount.toString())}`,
				]);
			} else {
				log.warn('Could not fetch Setu account balance.');
			}

			console.log('');
		});
}
