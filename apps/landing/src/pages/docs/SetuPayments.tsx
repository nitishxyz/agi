import { CodeBlock } from '../../components/CodeBlock';
export function SetuPayments() {
	return (
		<div>
			<h1 className="text-3xl font-bold mb-2">Payments</h1>
			<p className="text-otto-dim text-sm mb-8">
				Solana wallet authentication, x402 USDC payments, and Polar credit card
				top-ups.
			</p>

			<h2>Wallet Authentication</h2>
			<p>
				Every protected Setu endpoint requires Solana wallet authentication.
				Instead of API keys, you sign a timestamp nonce with your wallet's
				Ed25519 private key and send three headers:
			</p>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Header</th>
							<th>Value</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>x-wallet-address</code>
							</td>
							<td>Your Solana public key (base58)</td>
						</tr>
						<tr>
							<td>
								<code>x-wallet-signature</code>
							</td>
							<td>Ed25519 signature of the nonce (base58)</td>
						</tr>
						<tr>
							<td>
								<code>x-wallet-nonce</code>
							</td>
							<td>
								Current timestamp in milliseconds (e.g.{' '}
								<code>1706000000000</code>)
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h3>How Signing Works</h3>
			<ol>
				<li>
					Generate a nonce: the current <code>Date.now()</code> timestamp as a
					string
				</li>
				<li>Encode the nonce as UTF-8 bytes</li>
				<li>
					Sign those bytes with <code>nacl.sign.detached()</code> using the
					wallet's secret key
				</li>
				<li>Base58-encode the 64-byte signature</li>
			</ol>
			<CodeBlock>{`import nacl from "tweetnacl";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

// Load wallet from base58 private key
const privateKeyBytes = bs58.decode(process.env.SETU_PRIVATE_KEY);
const keypair = Keypair.fromSecretKey(privateKeyBytes);

function createAuthHeaders() {
  const nonce = Date.now().toString();
  const message = new TextEncoder().encode(nonce);
  const signature = nacl.sign.detached(message, keypair.secretKey);

  return {
    "x-wallet-address": keypair.publicKey.toBase58(),
    "x-wallet-signature": bs58.encode(signature),
    "x-wallet-nonce": nonce,
  };
}`}</CodeBlock>

			<h3>Server-Side Verification</h3>
			<p>The server verifies each request by:</p>
			<ol>
				<li>
					Decoding the public key from <code>x-wallet-address</code> to bytes
				</li>
				<li>
					Decoding the signature from <code>x-wallet-signature</code> via base58
				</li>
				<li>Encoding the nonce string to UTF-8 bytes</li>
				<li>
					Calling{' '}
					<code>
						nacl.sign.detached.verify(messageBytes, signatureBytes,
						publicKeyBytes)
					</code>
				</li>
				<li>
					Checking the nonce is within <strong>60 seconds</strong> of server
					time
				</li>
			</ol>
			<p>
				If the nonce is older than 60 seconds, the server returns{' '}
				<code>401 Nonce expired</code>.
			</p>

			<h3>Wallet Key Format</h3>
			<p>
				The <code>SETU_PRIVATE_KEY</code> is a base58-encoded Solana secret key
				(64 bytes when decoded). The first 32 bytes are the private scalar and
				the last 32 bytes are the public key. This is the standard Solana
				keypair format.
			</p>
			<CodeBlock>{`# Generate a new wallet
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const keypair = Keypair.generate();
const privateKey = bs58.encode(keypair.secretKey);     // store this
const publicKey = keypair.publicKey.toBase58();         // your wallet address

// Import an existing key
const imported = Keypair.fromSecretKey(bs58.decode(privateKey));`}</CodeBlock>

			<hr />

			<h2>x402 Payment Protocol</h2>
			<p>
				Setu uses the{' '}
				<a
					href="https://www.x402.org"
					target="_blank"
					rel="noopener noreferrer"
				>
					x402 protocol
				</a>{' '}
				for on-chain USDC payments. The x402 protocol extends HTTP 402 (Payment
				Required) into a machine-readable payment flow.
			</p>

			<h3>How It Works</h3>
			<ol>
				<li>
					<strong>Client makes an API request</strong> (e.g.{' '}
					<code>POST /v1/messages</code>)
				</li>
				<li>
					<strong>Server checks balance</strong> — if below <code>$0.05</code>,
					returns HTTP <code>402</code>
				</li>
				<li>
					<strong>
						402 response includes <code>accepts</code> array
					</strong>{' '}
					— each entry describes a USDC payment option with amount, network,
					asset, and destination
				</li>
				<li>
					<strong>Client picks a payment option</strong> and builds a signed
					USDC transfer transaction using the x402 SDK
				</li>
				<li>
					<strong>
						Client submits to <code>/v1/topup</code>
					</strong>{' '}
					with the signed transaction and the chosen payment requirement
				</li>
				<li>
					<strong>Server settles via facilitator</strong> — the payment is
					submitted to the{' '}
					<a
						href="https://facilitator.payai.network"
						target="_blank"
						rel="noopener noreferrer"
					>
						x402 facilitator
					</a>{' '}
					which handles on-chain confirmation
				</li>
				<li>
					<strong>Balance is credited</strong> and the client retries the
					original request
				</li>
			</ol>

			<h3>402 Response Format</h3>
			<CodeBlock>{`{
  "x402Version": 1,
  "error": {
    "message": "Balance too low. Please top up.",
    "type": "insufficient_balance",
    "current_balance": "0.00",
    "minimum_balance": "0.05",
    "topup_required": true
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana",
      "maxAmountRequired": "5000000",
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "payTo": "<platform-wallet>",
      "resource": "https://api.setu.ottocode.io/v1/responses",
      "description": "Top-up required for API access (5.00 USD)",
      "mimeType": "application/json",
      "maxTimeoutSeconds": 60,
      "extra": { "feePayer": "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4" }
    }
  ]
}`}</CodeBlock>
			<p>
				The <code>maxAmountRequired</code> is in <strong>micro-USDC</strong> (1
				USDC = 1,000,000). The <code>extra.feePayer</code> is the facilitator's
				fee payer account that covers Solana transaction fees.
			</p>

			<h3>Building the Payment Transaction</h3>
			<p>
				Use the <code>x402</code> npm package to create a signed payment
				transaction:
			</p>
			<CodeBlock>{`import { createPaymentHeader } from "x402/client";
import { svm } from "x402/shared";
import bs58 from "bs58";
import { Buffer } from "node:buffer";

const requirement = accepts[0]; // pick from 402 response

// Create a signer from your wallet's private key
const signer = await svm.createSignerFromBase58(
  bs58.encode(keypair.secretKey)
);

// Build the signed payment header
const header = await createPaymentHeader(
  signer,
  1, // x402 version
  requirement,
  { svmConfig: { rpcUrl: "https://api.mainnet-beta.solana.com" } }
);

// Decode the header to get the signed transaction
const decoded = JSON.parse(
  Buffer.from(header, "base64").toString("utf-8")
);

const paymentPayload = {
  x402Version: 1,
  scheme: "exact",
  network: requirement.network,
  payload: { transaction: decoded.payload.transaction },
};`}</CodeBlock>

			<h3>Submitting the Top-up</h3>
			<CodeBlock>{`const response = await fetch("https://api.setu.ottocode.io/v1/topup", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...createAuthHeaders(),
  },
  body: JSON.stringify({
    paymentPayload,
    paymentRequirement: requirement,
  }),
});

const result = await response.json();
// {
//   success: true,
//   amount: 5,
//   new_balance: "5.00000000",
//   transaction: "5Kf8mG..."
// }`}</CodeBlock>

			<h3>Duplicate Protection</h3>
			<p>
				Submitting the same signed transaction twice returns{' '}
				<code>{'{ success: true, duplicate: true }'}</code> without
				double-crediting. This makes retries safe.
			</p>

			<h3>Settlement Flow</h3>
			<p>
				The facilitator at <code>https://facilitator.payai.network/settle</code>{' '}
				receives the signed transaction and payment requirement, submits it to
				Solana, waits for on-chain confirmation, and returns the result. The
				facilitator also acts as the fee payer so the user doesn't need SOL for
				transaction fees.
			</p>

			<hr />

			<h2>Polar Payments (Credit Card)</h2>
			<p>
				For users who prefer credit card payments, Setu integrates with{' '}
				<a href="https://polar.sh" target="_blank" rel="noopener noreferrer">
					Polar
				</a>{' '}
				as a fiat on-ramp.
			</p>

			<h3>How It Works</h3>
			<ol>
				<li>
					Client calls <code>POST /v1/topup/polar</code> with desired credit
					amount and success URL
				</li>
				<li>
					Setu creates a Polar checkout session with the charge amount (credit +
					processing fees)
				</li>
				<li>Client redirects user to the Polar checkout URL</li>
				<li>After payment, Polar sends a webhook to Setu</li>
				<li>
					Setu verifies the webhook signature, confirms the payment, and credits
					the balance
				</li>
			</ol>

			<h3>Fee Structure</h3>
			<p>Polar payments include processing fees to cover the credit amount:</p>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Fee Component</th>
							<th>Rate</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Base fee</td>
							<td>4%</td>
						</tr>
						<tr>
							<td>International fee</td>
							<td>1.5%</td>
						</tr>
						<tr>
							<td>Fixed fee</td>
							<td>$0.40</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p>
				The charge amount is calculated so that after fees, the full credit
				amount is received:
			</p>
			<CodeBlock>{`chargeAmount = ceil((creditAmount + $0.40) / (1 - 0.055))`}</CodeBlock>

			<h3>Create Checkout</h3>
			<CodeBlock>{`POST /v1/topup/polar
Content-Type: application/json

{
  "amount": 10,
  "successUrl": "https://myapp.com/topup/success"
}

// Response:
{
  "success": true,
  "checkoutId": "polar_checkout_...",
  "checkoutUrl": "https://polar.sh/checkout/...",
  "creditAmount": 10,
  "chargeAmount": 11.03,
  "feeAmount": 1.03
}`}</CodeBlock>

			<h3>Estimate Fees</h3>
			<CodeBlock>{`GET /v1/topup/polar/estimate?amount=10

{
  "creditAmount": 10,
  "chargeAmount": 11.03,
  "feeAmount": 1.03,
  "feeBreakdown": {
    "basePercent": 4,
    "internationalPercent": 1.5,
    "fixedCents": 40
  }
}`}</CodeBlock>

			<h3>Check Status</h3>
			<CodeBlock>{`GET /v1/topup/polar/status?checkoutId=polar_checkout_...

{
  "checkoutId": "polar_checkout_...",
  "confirmed": true,
  "amountUsd": 10,
  "confirmedAt": "2026-01-20T10:00:00.000Z"
}`}</CodeBlock>

			<h3>Limits</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Limit</th>
							<th>Value</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Minimum top-up</td>
							<td>$5</td>
						</tr>
						<tr>
							<td>Maximum top-up</td>
							<td>$500</td>
						</tr>
					</tbody>
				</table>
			</div>

			<hr />

			<h2>Cost Tracking</h2>
			<p>
				Setu tracks per-request costs and returns them in two ways depending on
				whether the response is streaming.
			</p>

			<h3>Non-Streaming</h3>
			<p>Cost metadata is returned in response headers:</p>
			<CodeBlock>{`x-cost-usd: 0.00001234
x-balance-remaining: 4.99998766`}</CodeBlock>

			<h3>Streaming</h3>
			<p>
				Cost metadata is injected as an SSE comment at the end of the stream:
			</p>
			<CodeBlock>{`: setu {"cost_usd":"0.00000904","balance_remaining":"4.99856275","input_tokens":20,"output_tokens":11}`}</CodeBlock>
			<p>
				Parse it by looking for lines starting with <code>{': setu '}</code>:
			</p>
			<CodeBlock>{`for (const line of chunk.split("\\n")) {
  if (line.startsWith(": setu ")) {
    const data = JSON.parse(line.slice(7));
    console.log("Cost:", data.cost_usd, "Balance:", data.balance_remaining);
  }
}`}</CodeBlock>

			<h3>Pricing Formula</h3>
			<p>
				Cost per request is calculated from the model's per-million-token rates:
			</p>
			<CodeBlock>{`cost = (inputTokens / 1M × inputRate
      + cachedReadTokens / 1M × cacheReadRate
      + cacheWriteTokens / 1M × cacheWriteRate
      + outputTokens / 1M × outputRate) × 1.005`}</CodeBlock>
			<p>
				The <code>1.005</code> multiplier is the 0.5% markup.
			</p>

			<h2>Balance Endpoint</h2>
			<CodeBlock>{`GET /v1/balance
Headers: x-wallet-address, x-wallet-signature, x-wallet-nonce

{
  "wallet_address": "ABC123...",
  "balance_usd": 4.95,
  "total_spent": 0.05,
  "total_topups": 5.00,
  "request_count": 10,
  "created_at": "2026-01-20T10:00:00.000Z",
  "last_request": "2026-01-24T15:30:00.000Z"
}`}</CodeBlock>
		</div>
	);
}
