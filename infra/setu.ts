import { domains } from "./domains";
import {
  anthropicApiKey,
  databaseUrl,
  openAiApiKey,
  platformWallet,
} from "./secrets";

const DEPLOYED_STAGES = ["prod", "dev"];

export const setu = !DEPLOYED_STAGES.includes($app.stage)
  ? new sst.x.DevCommand("Setu", {
      environment: {
        DATABASE_URL: databaseUrl.value,
        OPENAI_API_KEY: openAiApiKey.value,
        ANTHROPIC_API_KEY: anthropicApiKey.value,
        PLATFORM_WALLET: platformWallet.value,
        STAGE: $app.stage || "dev",
      },
      dev: { command: "bun dev", directory: "apps/setu" },
    })
  : new sst.cloudflare.Worker("Setu", {
      url: true,
      handler: "apps/setu/src/index.ts",
      environment: {
        DATABASE_URL: databaseUrl.value,
        OPENAI_API_KEY: openAiApiKey.value,
        ANTHROPIC_API_KEY: anthropicApiKey.value,
        PLATFORM_WALLET: platformWallet.value,
        STAGE: $app.stage || "prod",
      },
      domain: domains.setu,
      transform: {
        worker: {
          observability: {
            enabled: true,
            logs: {
              enabled: true,
              invocationLogs: true,
            },
          },
        },
      },
    });

export const routerUrl = DEPLOYED_STAGES.includes($app.stage)
  ? (setu as sst.cloudflare.Worker).url
  : "http://localhost:4002";
