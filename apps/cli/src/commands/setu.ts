import type { Command } from 'commander';
import { log } from '@clack/prompts';
import qrcode from 'qrcode-terminal';
import { box, colors } from '../ui.ts';
import {
	getSetuBalance,
	getSetuWallet,
	getSetuUsdcBalance,
} from '@ottocode/api';

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

			const { data: walletData, error: walletError } = await getSetuWallet();

			if (walletError || !walletData) {
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

			const wallet = walletData as {
				configured: boolean;
				publicKey?: string;
				network?: string;
				rpcUrl?: string;
				setuUrl?: string;
			};

			if (!wallet.configured || !wallet.publicKey) {
				log.warn('No Setu wallet configured.');
				console.log(
					`  Run ${colors.cyan('otto setu --login')} to setup your wallet.`,
				);
				console.log('');
				return;
			}

			const publicKey = wallet.publicKey;
			const network = wallet.network ?? 'unknown';
			const rpcUrl = wallet.rpcUrl ?? '';
			const setuUrl = wallet.setuUrl ?? '';

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
			const [balanceResult, usdcResult] = await Promise.all([
				getSetuBalance(),
				getSetuUsdcBalance(),
			]);

			const usdcData = usdcResult.data as {
				usdcBalance: number;
			} | null;

			if (usdcData?.usdcBalance !== undefined) {
				console.log(
					`  USDC:     ${colors.green(`${usdcData.usdcBalance.toFixed(2)} USDC`)}`,
				);
			} else {
				console.log(`  USDC:     ${colors.dim('Could not fetch')}`);
			}

			const balanceData = balanceResult.data as {
				balance: number;
				totalSpent: number;
				totalTopups: number;
				requestCount: number;
			} | null;

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
