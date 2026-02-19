import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  generateWallet,
  importWallet,
  isValidPrivateKey,
  fetchBalance,
  fetchWalletUsdcBalance,
} from "@ottocode/ai-sdk";
import type { WalletInfo } from "@ottocode/ai-sdk";

const WALLET_DIR = join(homedir(), ".openclaw", "setu");
const WALLET_KEY_PATH = join(WALLET_DIR, "wallet.key");

export function getWalletKeyPath(): string {
  return WALLET_KEY_PATH;
}

export function loadWallet(): WalletInfo | null {
  try {
    if (!existsSync(WALLET_KEY_PATH)) return null;
    const privateKey = readFileSync(WALLET_KEY_PATH, "utf-8").trim();
    if (!isValidPrivateKey(privateKey)) return null;
    return importWallet(privateKey);
  } catch {
    return null;
  }
}

export function saveWallet(privateKey: string): WalletInfo {
  if (!isValidPrivateKey(privateKey)) {
    throw new Error("Invalid Solana private key");
  }
  const wallet = importWallet(privateKey);
  mkdirSync(WALLET_DIR, { recursive: true });
  writeFileSync(WALLET_KEY_PATH, privateKey, { mode: 0o600 });
  return wallet;
}

export function ensureWallet(): WalletInfo {
  const existing = loadWallet();
  if (existing) return existing;
  const wallet = generateWallet();
  saveWallet(wallet.privateKey);
  return wallet;
}

export function exportWalletKey(): string | null {
  try {
    if (!existsSync(WALLET_KEY_PATH)) return null;
    return readFileSync(WALLET_KEY_PATH, "utf-8").trim();
  } catch {
    return null;
  }
}

export async function getSetuBalance(privateKey: string): Promise<{
  setu: { balance: number; totalSpent: number; requestCount: number } | null;
  wallet: { usdcBalance: number; network: string } | null;
}> {
  const [setu, wallet] = await Promise.all([
    fetchBalance({ privateKey }),
    fetchWalletUsdcBalance({ privateKey }),
  ]);

  return {
    setu: setu
      ? {
          balance: setu.balance,
          totalSpent: setu.totalSpent,
          requestCount: setu.requestCount,
        }
      : null,
    wallet: wallet
      ? { usdcBalance: wallet.usdcBalance, network: wallet.network }
      : null,
  };
}
