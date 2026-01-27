/**
 * Router Test Client
 *
 * Usage:
 *   1. Generate a keypair: solana-keygen new -o test-wallet.json
 *   2. Fund it with devnet USDC
 *   3. Run: bun run test/client.ts [prompt]
 *
 * Or use SST dev mode:
 *   sst dev -- bun run test/client.ts "Your prompt here"
 */

import {
	Keypair,
	type PublicKey,
	type Transaction,
	type VersionedTransaction,
} from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createPaymentHeader, selectPaymentRequirements } from 'x402/client';
import { svm } from 'x402/shared';
import type { PaymentRequirements } from 'x402/types';
import * as fs from 'fs';

const BASE_URL = process.env.ROUTER_URL || 'http://localhost:4002';
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';

interface WalletAdapter {
	publicKey: PublicKey;
	secretKey: Uint8Array;
	signTransaction(
		tx: Transaction | VersionedTransaction,
	): Promise<Transaction | VersionedTransaction>;
}

class SimpleWallet implements WalletAdapter {
	constructor(private keypair: Keypair) {}

	get publicKey() {
		return this.keypair.publicKey;
	}

	get secretKey() {
		return this.keypair.secretKey;
	}

	async signTransaction(tx: Transaction | VersionedTransaction) {
		if ('version' in tx) {
			tx.sign([this.keypair]);
		} else {
			tx.partialSign(this.keypair);
		}
		return tx;
	}
}

function loadKeypair(keypairPath?: string): Keypair {
	const resolvedPath =
		keypairPath || process.env.KEYPAIR_PATH || './test-wallet.json';

	if (!fs.existsSync(resolvedPath)) {
		console.log(`\n⚠️  Keypair not found at ${resolvedPath}`);
		console.log('   Generate one with: solana-keygen new -o test-wallet.json');
		console.log('   Or set KEYPAIR_PATH environment variable\n');

		console.log('📝 Generating ephemeral keypair for testing...');
		return Keypair.generate();
	}

	const keypairData = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
	return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

function signMessage(keypair: Keypair, message: Uint8Array): Uint8Array {
	return nacl.sign.detached(message, keypair.secretKey);
}

function createAuthHeaders(wallet: WalletAdapter): Record<string, string> {
	const nonce = Date.now().toString();
	const message = new TextEncoder().encode(nonce);
	const signature = signMessage(
		Keypair.fromSecretKey(wallet.secretKey),
		message,
	);

	return {
		'x-wallet-address': wallet.publicKey.toBase58(),
		'x-wallet-signature': bs58.encode(signature),
		'x-wallet-nonce': nonce,
		'Content-Type': 'application/json',
	};
}

async function listModels() {
	console.log('\n📋 Available Models:');
	const res = await fetch(`${BASE_URL}/v1/models`);
	const data = (await res.json()) as any;

	const grouped = data.data.reduce((acc: any, m: any) => {
		const provider = m.owned_by;
		if (!acc[provider]) acc[provider] = [];
		acc[provider].push(m);
		return acc;
	}, {});

	for (const [provider, models] of Object.entries(grouped) as any) {
		console.log(`\n  ${provider.toUpperCase()}:`);
		models.slice(0, 5).forEach((m: any) => {
			const pricing = m.pricing
				? `$${m.pricing.input?.toFixed(2) || '?'}/$${m.pricing.output?.toFixed(2) || '?'} per 1M`
				: 'no pricing';
			console.log(`    - ${m.id} (${pricing})`);
		});
		if (models.length > 5) {
			console.log(`    ... and ${models.length - 5} more`);
		}
	}
}

async function getBalance(wallet: WalletAdapter): Promise<number> {
	const headers = createAuthHeaders(wallet);
	const res = await fetch(`${BASE_URL}/v1/balance`, { headers });

	if (!res.ok) {
		if (res.status === 401) {
			console.log('   (New wallet, no balance yet)');
			return 0;
		}
		throw new Error(`Balance check failed: ${res.status}`);
	}

	const data = (await res.json()) as any;
	return parseFloat(data.balance_usd);
}

async function handlePaymentRequired(
	wallet: WalletAdapter,
	response: Response,
): Promise<boolean> {
	const body = (await response.json()) as any;

	if (!body.accepts || body.accepts.length === 0) {
		console.log('❌ No payment options available');
		return false;
	}

	const requirement = selectPaymentRequirements(
		body.accepts as PaymentRequirements[],
		undefined,
		'exact',
	) as any;

	if (!requirement) {
		console.log('❌ No suitable payment requirement found');
		return false;
	}

	const amount = parseInt(requirement.maxAmountRequired) / 1_000_000;
	console.log(`\n💳 Payment Required: $${amount.toFixed(2)} USDC`);

	const privateKeyBase58 = bs58.encode(wallet.secretKey);
	const signer = await svm.createSignerFromBase58(privateKeyBase58);

	const paymentHeader = await createPaymentHeader(
		signer,
		1,
		requirement as PaymentRequirements,
		{ svmConfig: { rpcUrl: RPC_URL } },
	);

	const decoded = JSON.parse(
		Buffer.from(paymentHeader, 'base64').toString('utf-8'),
	);

	const paymentPayload = {
		x402Version: 1,
		scheme: 'exact',
		network: requirement.network,
		payload: { transaction: decoded.payload.transaction },
	};

	const headers = createAuthHeaders(wallet);
	const topupRes = await fetch(`${BASE_URL}/v1/topup`, {
		method: 'POST',
		headers,
		body: JSON.stringify({ paymentPayload, paymentRequirement: requirement }),
	});

	if (!topupRes.ok) {
		const err = await topupRes.json();
		console.log('❌ Top-up failed:', err);
		return false;
	}

	const topupResult = (await topupRes.json()) as any;
	console.log(`✅ Top-up successful! New balance: $${topupResult.new_balance}`);
	return true;
}

// OpenAI via /v1/responses
async function chatOpenAI(
	wallet: WalletAdapter,
	prompt: string,
	model = 'gpt-4o-mini',
	stream = false,
): Promise<string> {
	console.log(`\n💬 OpenAI request (model: ${model}, stream: ${stream})...`);

	const headers = createAuthHeaders(wallet);

	const res = await fetch(`${BASE_URL}/v1/responses`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			model,
			input: [{ role: 'user', content: prompt }],
			stream,
		}),
	});

	if (res.status === 402) {
		const paid = await handlePaymentRequired(wallet, res);
		if (paid) {
			return chatOpenAI(wallet, prompt, model, stream);
		}
		throw new Error('Payment required but failed');
	}

	if (!res.ok) {
		const error = await res.text();
		throw new Error(`OpenAI error: ${error}`);
	}

	if (stream) {
		let content = '';
		const reader = res.body?.getReader();
		const decoder = new TextDecoder();

		if (!reader) throw new Error('No response body');

		process.stdout.write('\n📝 Response:\n');

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value);
			const lines = chunk.split('\n').filter((l) => l.startsWith('data:'));

			for (const line of lines) {
				const data = line.slice(5).trim();
				if (data === '[DONE]') continue;

				try {
					const parsed = JSON.parse(data);
					// Handle response.output_text.delta
					if (parsed.type === 'response.output_text.delta' && parsed.delta) {
						content += parsed.delta;
						process.stdout.write(parsed.delta);
					}
				} catch {}
			}

			// Parse SSE comments for cost metadata
			const commentLines = chunk
				.split('\n')
				.filter((l) => l.startsWith(': solforge '));
			for (const line of commentLines) {
				try {
					const costData = JSON.parse(line.slice(11));
					console.log(`\n💰 Cost: $${costData.cost_usd}`);
					console.log(`💵 Balance: $${costData.balance_remaining}`);
				} catch {}
			}
		}
		return content;
	}

	const data = (await res.json()) as any;
	const content =
		data.output_text || data.output?.[0]?.content?.[0]?.text || '';

	console.log('\n📝 Response:', content);
	console.log(
		`\n📊 Usage: ${data.usage?.input_tokens} input + ${data.usage?.output_tokens} output`,
	);

	const costHeader = res.headers.get('x-cost-usd');
	const balanceHeader = res.headers.get('x-balance-remaining');
	if (costHeader) console.log(`💰 Cost: $${costHeader}`);
	if (balanceHeader) console.log(`💵 Balance: $${balanceHeader}`);

	return content;
}

// Anthropic via /v1/messages
async function chatAnthropic(
	wallet: WalletAdapter,
	prompt: string,
	model = 'claude-3-5-haiku-latest',
	stream = false,
): Promise<string> {
	console.log(`\n💬 Anthropic request (model: ${model}, stream: ${stream})...`);

	const headers = createAuthHeaders(wallet);

	const res = await fetch(`${BASE_URL}/v1/messages`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			model,
			max_tokens: 1024,
			messages: [{ role: 'user', content: prompt }],
			stream,
		}),
	});

	if (res.status === 402) {
		const paid = await handlePaymentRequired(wallet, res);
		if (paid) {
			return chatAnthropic(wallet, prompt, model, stream);
		}
		throw new Error('Payment required but failed');
	}

	if (!res.ok) {
		const error = await res.text();
		throw new Error(`Anthropic error: ${error}`);
	}

	if (stream) {
		let content = '';
		const reader = res.body?.getReader();
		const decoder = new TextDecoder();

		if (!reader) throw new Error('No response body');

		process.stdout.write('\n📝 Response:\n');

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value);
			const lines = chunk.split('\n').filter((l) => l.startsWith('data:'));

			for (const line of lines) {
				const data = line.slice(5).trim();
				if (data === '[DONE]') continue;

				try {
					const parsed = JSON.parse(data);
					// Handle content_block_delta
					if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
						content += parsed.delta.text;
						process.stdout.write(parsed.delta.text);
					}
				} catch {}
			}

			// Parse SSE comments for cost metadata
			const commentLines = chunk
				.split('\n')
				.filter((l) => l.startsWith(': solforge '));
			for (const line of commentLines) {
				try {
					const costData = JSON.parse(line.slice(11));
					console.log(`\n💰 Cost: $${costData.cost_usd}`);
					console.log(`💵 Balance: $${costData.balance_remaining}`);
				} catch {}
			}
		}
		return content;
	}

	const data = (await res.json()) as any;
	const content = data.content?.[0]?.text || '';

	console.log('\n📝 Response:', content);
	console.log(
		`\n📊 Usage: ${data.usage?.input_tokens} input + ${data.usage?.output_tokens} output`,
	);

	const costHeader = res.headers.get('x-cost-usd');
	const balanceHeader = res.headers.get('x-balance-remaining');
	if (costHeader) console.log(`💰 Cost: $${costHeader}`);
	if (balanceHeader) console.log(`💵 Balance: $${balanceHeader}`);

	return content;
}

async function main() {
	console.log('🚀 Solforge Router Test Client');
	console.log('================================');
	console.log(`📡 Router URL: ${BASE_URL}`);
	console.log(`🔗 RPC URL: ${RPC_URL}`);

	const keypair = loadKeypair();
	const wallet = new SimpleWallet(keypair);
	console.log(`\n🔑 Wallet: ${wallet.publicKey.toBase58()}`);

	await listModels();

	const balance = await getBalance(wallet);
	console.log(`\n💵 Current Balance: $${balance.toFixed(8)}`);

	const prompt = process.argv[2] || 'Hello, how are you?';
	console.log(`\n📝 Prompt: "${prompt}"`);

	// Test OpenAI (non-streaming)
	await chatOpenAI(wallet, prompt, 'gpt-4o-mini', false);

	// Test OpenAI (streaming)
	console.log('\n--- Testing OpenAI streaming ---');
	await chatOpenAI(
		wallet,
		'Count from 1 to 5, one number per line.',
		'gpt-4o-mini',
		true,
	);

	// Test Anthropic (non-streaming)
	console.log('\n--- Testing Anthropic (Claude) ---');
	await chatAnthropic(
		wallet,
		'What is the capital of France? Answer in one word.',
		'claude-3-5-haiku-latest',
		false,
	);

	// Test Anthropic (streaming)
	console.log('\n--- Testing Anthropic streaming ---');
	await chatAnthropic(
		wallet,
		'List 3 colors, one per line.',
		'claude-3-5-haiku-latest',
		true,
	);

	const finalBalance = await getBalance(wallet);
	console.log(`\n💵 Final Balance: $${finalBalance.toFixed(8)}`);

	console.log('\n✅ Test complete!');
}

main().catch((err) => {
	console.error('\n❌ Test failed:', err.message);
	process.exit(1);
});
