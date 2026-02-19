#!/usr/bin/env bun

import {
  loadWallet,
  saveWallet,
  ensureWallet,
  exportWalletKey,
  getWalletKeyPath,
  getSetuBalance,
} from "./wallet.ts";
import { injectConfig, removeConfig, isConfigured, getConfigPath } from "./config.ts";
import { createProxy } from "./proxy.ts";
import { isValidPrivateKey } from "@ottocode/ai-sdk";
import * as readline from "node:readline";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function printHelp() {
  console.log(`
openclaw-setu — Pay for AI with Solana USDC

Usage:
  openclaw-setu setup              Interactive setup (wallet + config)
  openclaw-setu start              Start the local proxy server
  openclaw-setu stop               Stop (placeholder — use Ctrl+C)

  openclaw-setu wallet generate    Generate a new Solana wallet
  openclaw-setu wallet import      Import an existing private key
  openclaw-setu wallet export      Export your private key
  openclaw-setu wallet info        Show wallet address and balances

  openclaw-setu config inject      Inject Setu provider into openclaw.json
  openclaw-setu config remove      Remove Setu provider from openclaw.json
  openclaw-setu config status      Check if Setu is configured

  openclaw-setu help               Show this help
`);
}

async function cmdSetup() {
  console.log("\n  Setu — Pay for AI with Solana USDC\n");

  const existing = loadWallet();
  let wallet = existing;

  if (existing) {
    console.log(`  Existing wallet found: ${existing.publicKey}`);
    const choice = await prompt("  Use existing wallet? (Y/n): ");
    if (choice.toLowerCase() === "n") {
      const action = await prompt("  (g)enerate new or (i)mport existing? ");
      if (action.toLowerCase() === "i") {
        const key = await prompt("  Enter Solana private key (base58): ");
        if (!isValidPrivateKey(key)) {
          console.error("  Invalid private key.");
          process.exit(1);
        }
        wallet = saveWallet(key);
        console.log(`  Wallet imported: ${wallet.publicKey}`);
      } else {
        wallet = ensureWallet();
        console.log(`  New wallet generated: ${wallet.publicKey}`);
      }
    }
  } else {
    const action = await prompt(
      "  No wallet found. (g)enerate new or (i)mport existing? ",
    );
    if (action.toLowerCase() === "i") {
      const key = await prompt("  Enter Solana private key (base58): ");
      if (!isValidPrivateKey(key)) {
        console.error("  Invalid private key.");
        process.exit(1);
      }
      wallet = saveWallet(key);
      console.log(`  Wallet imported: ${wallet.publicKey}`);
    } else {
      wallet = ensureWallet();
      console.log(`  New wallet generated: ${wallet.publicKey}`);
    }
  }

  if (!wallet) {
    console.error("  Failed to set up wallet.");
    process.exit(1);
  }

  console.log(`\n  Wallet: ${wallet.publicKey}`);
  console.log(`  Key stored at: ${getWalletKeyPath()}`);

  await injectConfig();
  console.log(`  OpenClaw config updated: ${getConfigPath()}`);

  console.log(`
  Setup complete!

  Next steps:
    1. Fund your wallet with USDC on Solana:
       ${wallet.publicKey}

    2. Start the proxy:
       openclaw-setu start

    3. Restart OpenClaw:
       openclaw gateway restart

  Your wallet address is your identity — no API keys needed.
`);
}

async function cmdWalletGenerate() {
  const existing = loadWallet();
  if (existing) {
    const choice = await prompt(
      `Wallet exists (${existing.publicKey}). Overwrite? (y/N): `,
    );
    if (choice.toLowerCase() !== "y") {
      console.log("Cancelled.");
      return;
    }
  }
  const wallet = ensureWallet();
  console.log(`Wallet generated: ${wallet.publicKey}`);
  console.log(`Key stored at: ${getWalletKeyPath()}`);
  console.log(`\nFund with USDC on Solana: ${wallet.publicKey}`);
}

async function cmdWalletImport() {
  const key = await prompt("Enter Solana private key (base58): ");
  if (!isValidPrivateKey(key)) {
    console.error("Invalid private key.");
    process.exit(1);
  }
  const wallet = saveWallet(key);
  console.log(`Wallet imported: ${wallet.publicKey}`);
}

function cmdWalletExport() {
  const key = exportWalletKey();
  if (!key) {
    console.error("No wallet found. Run `openclaw-setu setup` first.");
    process.exit(1);
  }
  console.log(key);
}

async function cmdWalletInfo() {
  const wallet = loadWallet();
  if (!wallet) {
    console.error("No wallet found. Run `openclaw-setu setup` first.");
    process.exit(1);
  }

  console.log(`\nWallet: ${wallet.publicKey}`);
  console.log(`Key path: ${getWalletKeyPath()}`);

  console.log("\nFetching balances...");
  const balances = await getSetuBalance(wallet.privateKey);

  if (balances.setu) {
    console.log(`\nSetu Balance: $${balances.setu.balance.toFixed(4)}`);
    console.log(`Total Spent:  $${balances.setu.totalSpent.toFixed(4)}`);
    console.log(`Requests:     ${balances.setu.requestCount}`);
  } else {
    console.log("\nSetu Balance: (not available — wallet may not be registered yet)");
  }

  if (balances.wallet) {
    console.log(
      `\nOn-chain USDC: $${balances.wallet.usdcBalance.toFixed(4)} (${balances.wallet.network})`,
    );
  }
}

async function cmdConfigInject() {
  await injectConfig();
  console.log(`Setu provider injected into ${getConfigPath()}`);
}

function cmdConfigRemove() {
  removeConfig();
  console.log(`Setu provider removed from ${getConfigPath()}`);
}

function cmdConfigStatus() {
  if (isConfigured()) {
    console.log(`Setu is configured in ${getConfigPath()}`);
  } else {
    console.log("Setu is not configured. Run `openclaw-setu setup`.");
  }
}

function cmdStart() {
  const port = parseInt(process.env.SETU_PROXY_PORT ?? "8403", 10);
  const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");

  try {
    const { wallet } = createProxy({ port, verbose });
    console.log(`\nSetu proxy running on http://localhost:${port}`);
    console.log(`Wallet: ${wallet.publicKey}`);
    console.log(`\nPress Ctrl+C to stop.\n`);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

const [cmd, sub] = process.argv.slice(2);

switch (cmd) {
  case "setup":
    cmdSetup();
    break;
  case "start":
    cmdStart();
    break;
  case "wallet":
    switch (sub) {
      case "generate":
        cmdWalletGenerate();
        break;
      case "import":
        cmdWalletImport();
        break;
      case "export":
        cmdWalletExport();
        break;
      case "info":
        cmdWalletInfo();
        break;
      default:
        console.error('Unknown wallet command. Use: generate, import, export, info');
        process.exit(1);
    }
    break;
  case "config":
    switch (sub) {
      case "inject":
        cmdConfigInject();
        break;
      case "remove":
        cmdConfigRemove();
        break;
      case "status":
        cmdConfigStatus();
        break;
      default:
        console.error("Unknown config command. Use: inject, remove, status");
        process.exit(1);
    }
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exit(1);
}
