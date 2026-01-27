import { domains } from "./domains";
import {
  anthropicApiKey,
  databaseUrl,
  openAiApiKey,
  platformWallet,
} from "./secrets";

const DEPLOYED_STAGES = ["prod", "dev"];

export const router = !DEPLOYED_STAGES.includes($app.stage)
  ? new sst.x.DevCommand("Router", {
      environment: {
        DATABASE_URL: databaseUrl.value,
        OPENAI_API_KEY: openAiApiKey.value,
        ANTHROPIC_API_KEY: anthropicApiKey.value,
        PLATFORM_WALLET: platformWallet.value,
        STAGE: $app.stage || "dev",
      },
      dev: { command: "bun dev", directory: "apps/router" },
    })
  : new sst.cloudflare.Worker("Router", {
      url: true,
      handler: "apps/router/src/index.ts",
      environment: {
        DATABASE_URL: databaseUrl.value,
        OPENAI_API_KEY: openAiApiKey.value,
        ANTHROPIC_API_KEY: anthropicApiKey.value,
        PLATFORM_WALLET: platformWallet.value,
        STAGE: $app.stage || "prod",
      },
      domain: domains.router,
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
  ? (router as sst.cloudflare.Worker).url
  : "http://localhost:4002";
