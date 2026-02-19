import type {
  OpenClawPluginDefinition,
  OpenClawPluginApi,
  OpenClawPluginCommandDefinition,
} from "./types.ts";
import {
  loadWallet,
  ensureWallet,
  getSetuBalance,
  getWalletKeyPath,
} from "./wallet.ts";
import {
  buildProviderConfig,
  injectConfig,
  injectAuthProfile,
  isConfigured,
} from "./config.ts";
import { isValidPrivateKey } from "@ottocode/ai-sdk";

const DEFAULT_PORT = 8403;

function getPort(api: OpenClawPluginApi): number {
  const cfg = api.pluginConfig as Record<string, unknown> | undefined;
  return (cfg?.port as number) ?? DEFAULT_PORT;
}

const plugin: OpenClawPluginDefinition = {
  id: "setu",
  name: "Setu",
  description: "Pay for AI with Solana USDC — no API keys, just a wallet.",
  version: "0.1.0",

  async register(api: OpenClawPluginApi) {
    const port = getPort(api);

    await injectConfig(port).catch(() => {});
    try { injectAuthProfile(); } catch {}

    if (!api.config.models) {
      api.config.models = { providers: {} };
    }
    if (!api.config.models.providers) {
      api.config.models.providers = {};
    }
    const providerConfig = buildProviderConfig(port);
    api.config.models.providers.setu = {
      baseUrl: providerConfig.baseUrl,
      api: providerConfig.api,
      apiKey: providerConfig.apiKey,
      models: providerConfig.models,
    };

    if (!api.config.agents) api.config.agents = {};
    const agents = api.config.agents as Record<string, unknown>;
    if (!agents.defaults) agents.defaults = {};
    const defaults = agents.defaults as Record<string, unknown>;
    if (!defaults.model) defaults.model = {};
    const model = defaults.model as Record<string, unknown>;
    if (!model.primary) {
      model.primary = "setu/claude-sonnet-4-6";
    }

    api.registerProvider({
      id: "setu",
      label: "Setu (Solana USDC)",
      aliases: ["setu-solana"],
      envVars: ["SETU_PRIVATE_KEY"],
      models: buildProviderConfig(port),
      auth: [
        {
          id: "setu-wallet",
          label: "Solana Wallet",
          hint: "Generate or import a Solana wallet — pay per token with USDC",
          kind: "custom",
          async run(ctx) {
            const existing = loadWallet();

            if (existing) {
              ctx.prompter.note(
                `Existing Setu wallet found: ${existing.publicKey}`,
              );
              return {
                profiles: [
                  {
                    profileId: "setu-wallet",
                    credential: {
                      apiKey: "setu-proxy-handles-auth",
                      type: "wallet",
                      walletAddress: existing.publicKey,
                    },
                  },
                ],
                configPatch: {
                  models: { providers: { setu: buildProviderConfig(port) } },
                },
                defaultModel: `setu/claude-sonnet-4-6`,
                notes: [
                  `Wallet: ${existing.publicKey}`,
                  `Fund with USDC on Solana to start using.`,
                  `Run \`openclaw-setu start\` to start the proxy.`,
                ],
              };
            }

            const keyInput = await ctx.prompter.text({
              message:
                "Enter Solana private key (base58) or press Enter to generate a new one:",
              validate: (value: string) => {
                if (value && !isValidPrivateKey(value)) {
                  return "Invalid Solana private key";
                }
                return undefined;
              },
            });

            const key = typeof keyInput === "string" ? keyInput : "";
            const wallet = key ? ensureWallet() : ensureWallet();
            if (key && isValidPrivateKey(key)) {
              const { saveWallet } = await import("./wallet.ts");
              saveWallet(key);
            }

            const finalWallet = loadWallet()!;

            await injectConfig(port);

            return {
              profiles: [
                {
                  profileId: "setu-wallet",
                  credential: {
                    apiKey: "setu-proxy-handles-auth",
                    type: "wallet",
                    walletAddress: finalWallet.publicKey,
                  },
                },
              ],
              configPatch: {
                models: { providers: { setu: buildProviderConfig(port) } },
              },
              defaultModel: `setu/claude-sonnet-4-6`,
              notes: [
                `Wallet generated: ${finalWallet.publicKey}`,
                `Key stored at: ${getWalletKeyPath()}`,
                `Fund with USDC on Solana: ${finalWallet.publicKey}`,
                `Run \`openclaw-setu start\` to start the proxy.`,
              ],
            };
          },
        },
      ],
    });

    const walletCmd: OpenClawPluginCommandDefinition = {
      name: "wallet",
      description: "Show your Setu wallet address and balances",
      requireAuth: true,
      async handler() {
        const wallet = loadWallet();
        if (!wallet) {
          return { text: "No Setu wallet found. Run `openclaw-setu setup`." };
        }

        const balances = await getSetuBalance(wallet.privateKey);
        const lines = [`Wallet: ${wallet.publicKey}`];

        if (balances.setu) {
          lines.push(`Setu Balance: $${balances.setu.balance.toFixed(4)}`);
          lines.push(`Total Spent: $${balances.setu.totalSpent.toFixed(4)}`);
          lines.push(`Requests: ${balances.setu.requestCount}`);
        }
        if (balances.wallet) {
          lines.push(
            `On-chain USDC: $${balances.wallet.usdcBalance.toFixed(4)} (${balances.wallet.network})`,
          );
        }

        return { text: lines.join("\n") };
      },
    };

    api.registerCommand(walletCmd);

    const statusCmd: OpenClawPluginCommandDefinition = {
      name: "setu-status",
      description: "Check Setu plugin configuration status",
      async handler() {
        const wallet = loadWallet();
        const configured = isConfigured();
        const lines = [
          `Wallet: ${wallet ? wallet.publicKey : "not set up"}`,
          `OpenClaw config: ${configured ? "injected" : "not configured"}`,
          `Proxy port: ${port}`,
        ];
        return { text: lines.join("\n") };
      },
    };

    api.registerCommand(statusCmd);

    api.registerService({
      id: "setu-proxy",
      async start() {
        const wallet = loadWallet();
        if (!wallet) {
          api.logger.warn(
            "Setu: No wallet found. Run `openclaw-setu setup` first.",
          );
          return;
        }
        try {
          const { createProxy } = await import("./proxy.ts");
          createProxy({ port, verbose: false });
          api.logger.info(
            `Setu proxy running on http://localhost:${port}`,
          );
        } catch (err) {
          api.logger.error(`Setu proxy failed: ${(err as Error).message}`);
        }
      },
    });
  },
};

export default plugin;
