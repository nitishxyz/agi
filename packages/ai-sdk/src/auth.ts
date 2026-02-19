import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import type { SetuAuth } from './types.ts';

export interface WalletContext {
  keypair: Keypair;
  walletAddress: string;
  privateKeyBytes: Uint8Array;
}

export function createWalletContext(auth: Required<SetuAuth>): WalletContext {
  const privateKeyBytes = bs58.decode(auth.privateKey!);
  const keypair = Keypair.fromSecretKey(privateKeyBytes);
  const walletAddress = keypair.publicKey.toBase58();
  return { keypair, walletAddress, privateKeyBytes };
}

export function signNonce(nonce: string, secretKey: Uint8Array): string {
  const data = new TextEncoder().encode(nonce);
  const signature = nacl.sign.detached(data, secretKey);
  return bs58.encode(signature);
}

export function buildWalletHeaders(ctx: WalletContext): Record<string, string> {
  const nonce = Date.now().toString();
  const signature = signNonce(nonce, ctx.privateKeyBytes);
  return {
    'x-wallet-address': ctx.walletAddress,
    'x-wallet-nonce': nonce,
    'x-wallet-signature': signature,
  };
}

export function getPublicKeyFromPrivate(privateKey?: string): string | null {
  if (!privateKey) return null;
  try {
    const privateKeyBytes = bs58.decode(privateKey);
    const keypair = Keypair.fromSecretKey(privateKeyBytes);
    return keypair.publicKey.toBase58();
  } catch {
    return null;
  }
}
