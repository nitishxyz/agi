/**
 * AI SDK Test Client for Setu Router
 * 
 * Uses native AI SDK providers:
 * - @ai-sdk/openai for OpenAI models (via /v1/responses)
 * - @ai-sdk/anthropic for Anthropic models (via /v1/messages)
 * 
 * Usage:
 *   bun run test/ai-sdk-client.ts
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, streamText } from 'ai';
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createPaymentHeader, selectPaymentRequirements } from 'x402/client';
import { svm } from 'x402/shared';
import type { PaymentRequirements } from 'x402/types';
import * as fs from 'fs';

const BASE_URL = process.env.ROUTER_URL || 'http://localhost:4002';
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';

function loadKeypair(): Keypair {
  const keypairPath = process.env.KEYPAIR_PATH || './test-wallet.json';
  
  if (!fs.existsSync(keypairPath)) {
    console.log('⚠️  No keypair found, generating ephemeral one...');
    return Keypair.generate();
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

const keypair = loadKeypair();
const walletAddress = keypair.publicKey.toBase58();

function createAuthHeaders(): Record<string, string> {
  const nonce = Date.now().toString();
  const message = new TextEncoder().encode(nonce);
  const signature = nacl.sign.detached(message, keypair.secretKey);

  return {
    'x-wallet-address': walletAddress,
    'x-wallet-signature': bs58.encode(signature),
    'x-wallet-nonce': nonce,
  };
}

async function handleTopup(body: any): Promise<boolean> {
  if (!body.accepts?.[0]) return false;

  const requirement = selectPaymentRequirements(
    body.accepts as PaymentRequirements[],
    undefined,
    'exact',
  ) as any;

  if (!requirement) return false;

  const amount = parseInt(requirement.maxAmountRequired) / 1_000_000;
  console.log(`💳 Auto top-up: $${amount.toFixed(2)} USDC`);

  const privateKeyBase58 = bs58.encode(keypair.secretKey);
  const signer = await svm.createSignerFromBase58(privateKeyBase58);

  const paymentHeader = await createPaymentHeader(
    signer,
    1,
    requirement as PaymentRequirements,
    { svmConfig: { rpcUrl: RPC_URL } },
  );

  const decoded = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'));

  const paymentPayload = {
    x402Version: 1,
    scheme: 'exact',
    network: requirement.network,
    payload: { transaction: decoded.payload.transaction },
  };

  const headers = createAuthHeaders();
  const topupRes = await fetch(`${BASE_URL}/v1/topup`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentPayload, paymentRequirement: requirement }),
  });

  if (!topupRes.ok) {
    console.log('❌ Top-up failed');
    return false;
  }

  const result = await topupRes.json() as any;
  console.log(`✅ Topped up! Balance: $${result.new_balance}`);
  return true;
}

function createAutoTopupFetch(): typeof fetch {
  return async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const headers = {
      ...createAuthHeaders(),
      ...(init?.headers as Record<string, string> || {}),
    };

    const response = await fetch(input, { ...init, headers });

    if (response.status === 402) {
      const body = await response.clone().json();
      const success = await handleTopup(body);
      
      if (success) {
        const retryHeaders = {
          ...createAuthHeaders(),
          ...(init?.headers as Record<string, string> || {}),
        };
        return fetch(input, { ...init, headers: retryHeaders });
      }
    }

    return response;
  } as typeof fetch;
}

// Helper to format usage (AI SDK v6 uses inputTokens/outputTokens)
function formatUsage(usage: any): string {
  if (!usage) return 'not available';
  const input = usage.inputTokens ?? usage.promptTokens ?? 0;
  const output = usage.outputTokens ?? usage.completionTokens ?? 0;
  return `${input} input + ${output} output tokens`;
}

// OpenAI provider - uses /v1/responses (AI SDK v6)
const openai = createOpenAI({
  baseURL: `${BASE_URL}/v1`,
  apiKey: 'not-needed',
  fetch: createAutoTopupFetch(),
});

// Anthropic provider - uses /v1/messages
const anthropic = createAnthropic({
  baseURL: `${BASE_URL}/v1`,
  apiKey: 'not-needed',
  fetch: createAutoTopupFetch(),
});

async function testOpenAIGenerate() {
  console.log('\n--- OpenAI Tests ---');
  console.log('\n📝 OpenAI generateText (non-streaming)...');
  
  const result = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: 'What is 2 + 2? Answer in one word.',
  });

  console.log('Response:', result.text);
  console.log('Usage:', formatUsage(result.usage));
}

async function testOpenAIStream() {
  console.log('\n📝 OpenAI streamText (streaming)...');
  
  const result = streamText({
    model: openai('gpt-4o-mini'),
    prompt: 'Count from 1 to 5, one number per line.',
  });

  process.stdout.write('Response:\n');
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  console.log('');
  
  const usage = await result.usage;
  console.log('Usage:', formatUsage(usage));
}

async function testClaudeGenerate() {
  console.log('\n--- Anthropic Tests ---');
  console.log('\n📝 Claude generateText (non-streaming)...');
  
  const result = await generateText({
    model: anthropic('claude-3-5-haiku-latest'),
    prompt: 'What is the capital of Japan? Answer in one word.',
  });

  console.log('Response:', result.text);
  console.log('Usage:', formatUsage(result.usage));
}

async function testClaudeStream() {
  console.log('\n📝 Claude streamText (streaming)...');
  
  const result = streamText({
    model: anthropic('claude-3-5-haiku-latest'),
    prompt: 'List 3 planets, one per line.',
  });

  process.stdout.write('Response:\n');
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  console.log('');
  
  const usage = await result.usage;
  console.log('Usage:', formatUsage(usage));
}

async function main() {
  console.log('🚀 AI SDK Router Test (Native Providers)');
  console.log('==========================================');
  console.log(`📡 Router: ${BASE_URL}`);
  console.log(`🔑 Wallet: ${walletAddress}`);
  console.log('\nEndpoints:');
  console.log('  OpenAI:    /v1/responses');
  console.log('  Anthropic: /v1/messages');

  try {
    await testOpenAIGenerate();
    await testOpenAIStream();
    await testClaudeGenerate();
    await testClaudeStream();
    
    console.log('\n✅ All tests passed!');
  } catch (err: any) {
    console.error('\n❌ Test failed:', err.message);
    console.error(err.stack);
    
    if (err.message.includes('402')) {
      console.log('\n💡 Your wallet needs USDC. Fund it and try again.');
    }
  }
}

main().catch(console.error);
