import type { Command } from 'commander';
import { log } from '@clack/prompts';
import qrcode from 'qrcode-terminal';
import { box, colors } from '../ui.ts';
import { loadConfig, getAuth } from '@agi-cli/sdk';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

const DEFAULT_SOLFORGE_URL = 'https://router.agi.nitish.sh';
const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const USDC_MINT_MAINNET = new PublicKey(
	'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
);
const USDC_MINT_DEVNET = new PublicKey(
	'4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
);

function signNonce(nonce: string, secretKey: Uint8Array): string {
	const data = new TextEncoder().encode(nonce);
	const signature = nacl.sign.detached(data, secretKey);
	return bs58.encode(signature);
}

function detectNetwork(rpcUrl: string): 'mainnet' | 'devnet' | 'unknown' {
	if (rpcUrl.includes('devnet')) return 'devnet';
	if (rpcUrl.includes('mainnet')) return 'mainnet';
	if (rpcUrl.includes('api.mainnet-beta')) return 'mainnet';
	return 'unknown';
}

async function fetchSolforgeBalance(
	privateKey: string,
	solforgeUrl: string,
): Promise<{
	balance: number;
	totalSpent: number;
	totalTopups: number;
	requestCount: number;
} | null> {
	try {
		const privateKeyBytes = bs58.decode(privateKey);
		const keypair = Keypair.fromSecretKey(privateKeyBytes);
		const walletAddress = keypair.publicKey.toBase58();

		const nonce = Date.now().toString();
		const signature = signNonce(nonce, privateKeyBytes);

		const response = await fetch(`${solforgeUrl}/v1/balance`, {
			headers: {
				'x-wallet-address': walletAddress,
				'x-wallet-nonce': nonce,
				'x-wallet-signature': signature,
			},
		});

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as {
			balance_usd: number;
			total_spent: number;
			total_topups: number;
			request_count: number;
		};

		return {
			balance: data.balance_usd,
			totalSpent: data.total_spent,
			totalTopups: data.total_topups,
			requestCount: data.request_count,
		};
	} catch {
		return null;
	}
}

async function fetchUsdcBalance(
	publicKey: PublicKey,
	rpcUrl: string,
	network: 'mainnet' | 'devnet' | 'unknown',
): Promise<{ balance: number | null; error?: string }> {
	try {
		const connection = new Connection(rpcUrl, 'confirmed');
		const usdcMint =
			network === 'devnet' ? USDC_MINT_DEVNET : USDC_MINT_MAINNET;
		const ata = await getAssociatedTokenAddress(usdcMint, publicKey);
		const balance = await connection.getTokenAccountBalance(ata);
		return { balance: balance.value.uiAmount };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (msg.includes('could not find account')) {
			return { balance: null, error: 'No USDC account' };
		}
		return { balance: null, error: 'RPC error' };
	}
}

export function registerSolforgeCommand(program: Command) {
	program
		.command('solforge')
		.description('Manage Solforge wallet and view balance')
		.option('--login', 'Login/setup Solforge wallet')
		.action(async (options) => {
			const { runAuth } = await import('../auth.ts');

			if (options.login) {
				await runAuth(['login', 'solforge']);
				return;
			}

			console.log('');
			console.log(colors.bold('  Solforge Wallet'));
			console.log('');

			const cfg = await loadConfig(process.cwd());
			const auth = await getAuth('solforge', cfg.projectRoot);

			if (!auth || auth.type !== 'wallet') {
				log.warn('No Solforge wallet configured.');
				console.log(
					`  Run ${colors.cyan('agi solforge --login')} to setup your wallet.`,
				);
				console.log(
					`  Or set ${colors.cyan('SOLFORGE_PRIVATE_KEY')} environment variable.`,
				);
				console.log('');
				return;
			}

			const privateKey = auth.secret;
			let publicKey: string;
			let keypair: Keypair;

			try {
				const privateKeyBytes = bs58.decode(privateKey);
				keypair = Keypair.fromSecretKey(privateKeyBytes);
				publicKey = keypair.publicKey.toBase58();
			} catch {
				log.error('Invalid wallet configuration. Please re-authenticate.');
				console.log('');
				return;
			}

			const rpcUrl =
				process.env.SOLFORGE_SOLANA_RPC_URL ||
				process.env.SOLANA_RPC_URL ||
				DEFAULT_RPC_URL;
			const network = detectNetwork(rpcUrl);
			const solforgeUrl = process.env.SOLFORGE_BASE_URL || DEFAULT_SOLFORGE_URL;

			const networkLabel =
				network === 'mainnet'
					? colors.green('mainnet')
					: network === 'devnet'
						? colors.yellow('devnet')
						: colors.dim('unknown');

			// Show static wallet info immediately
			const walletLines = [
				`Public Key: ${colors.cyan(publicKey)}`,
				`Network:    ${networkLabel}`,
				`RPC:        ${colors.dim(rpcUrl)}`,
				`Solforge:   ${colors.dim(solforgeUrl)}`,
			];

			box('Wallet', walletLines);

			console.log(colors.bold('  Wallet QR Code'));
			console.log('');
			qrcode.generate(publicKey, { small: true }, (qr: string) => {
				console.log(qr);
			});

			// Fetch balances from remote
			console.log(colors.dim('  Fetching balances...'));
			const [balanceData, usdcResult] = await Promise.all([
				fetchSolforgeBalance(privateKey, solforgeUrl),
				fetchUsdcBalance(keypair.publicKey, rpcUrl, network),
			]);

			if (usdcResult.balance !== null) {
				console.log(
					`  USDC:     ${colors.green(`${usdcResult.balance.toFixed(2)} USDC`)}`,
				);
			} else if (usdcResult.error) {
				console.log(`  USDC:     ${colors.dim(usdcResult.error)}`);
			}

			if (balanceData) {
				box('Solforge Account', [
					`Balance:      ${colors.green(`$${balanceData.balance.toFixed(4)}`)}`,
					`Total Spent:  ${colors.dim(`$${balanceData.totalSpent.toFixed(4)}`)}`,
					`Total Topups: ${colors.dim(`$${balanceData.totalTopups.toFixed(4)}`)}`,
					`Requests:     ${colors.dim(balanceData.requestCount.toString())}`,
				]);
			} else {
				log.warn('Could not fetch Solforge account balance.');
			}

			console.log('');
		});
}

export { fetchSolforgeBalance };
