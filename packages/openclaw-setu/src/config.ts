import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ModelApi } from "./types.ts";

const OPENCLAW_DIR = join(homedir(), ".openclaw");
const OPENCLAW_CONFIG_PATH = join(OPENCLAW_DIR, "openclaw.json");

const PROVIDER_KEY = "setu";
const DEFAULT_PROXY_PORT = 8403;
const DEFAULT_BASE_URL = "https://api.setu.ottocode.io";

export interface SetuModelConfig {
  id: string;
  name: string;
  api?: ModelApi;
  reasoning?: boolean;
  input?: Array<"text" | "image">;
  contextWindow?: number;
  maxTokens?: number;
}

export interface SetuProviderConfig {
  baseUrl: string;
  apiKey: string;
  api: ModelApi;
  authHeader: boolean;
  models: SetuModelConfig[];
}

function readOpenClawConfig(): Record<string, unknown> {
  if (!existsSync(OPENCLAW_CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(OPENCLAW_CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function writeOpenClawConfig(config: Record<string, unknown>): void {
  writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

interface CatalogModel {
  id: string;
  owned_by: string;
  context_length: number;
  max_output: number;
  capabilities?: { tool_call?: boolean; reasoning?: boolean };
}

function apiForOwner(owner: string): ModelApi {
  switch (owner) {
    case "anthropic":
      return "anthropic-messages";
    case "google":
      return "google-generative-ai";
    default:
      return "openai-completions";
  }
}

function displayName(id: string, owner: string): string {
  return `${id} (${owner}, via Setu)`;
}

export async function fetchModelsFromCatalog(
  baseURL: string = DEFAULT_BASE_URL,
): Promise<SetuModelConfig[]> {
  try {
    const resp = await fetch(`${baseURL}/v1/models`);
    if (!resp.ok) return getDefaultModels();
    const data = (await resp.json()) as { data: CatalogModel[] };
    return data.data.map((m) => ({
      id: m.id,
      name: displayName(m.id, m.owned_by),
      api: apiForOwner(m.owned_by),
      reasoning: m.capabilities?.reasoning ?? false,
      input: ["text"] as Array<"text" | "image">,
      contextWindow: m.context_length,
      maxTokens: m.max_output,
    }));
  } catch {
    return getDefaultModels();
  }
}

export function getDefaultModels(): SetuModelConfig[] {
  return [
    {
      id: "claude-sonnet-4-6",
      name: "Claude Sonnet 4.6 (anthropic, via Setu)",
      api: "anthropic-messages",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 200000,
      maxTokens: 64000,
    },
    {
      id: "claude-sonnet-4-5",
      name: "Claude Sonnet 4.5 (anthropic, via Setu)",
      api: "anthropic-messages",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 200000,
      maxTokens: 64000,
    },
    {
      id: "claude-opus-4-6",
      name: "Claude Opus 4.6 (anthropic, via Setu)",
      api: "anthropic-messages",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 200000,
      maxTokens: 128000,
    },
    {
      id: "claude-3-5-haiku-20241022",
      name: "Claude 3.5 Haiku (anthropic, via Setu)",
      api: "anthropic-messages",
      reasoning: false,
      input: ["text", "image"],
      contextWindow: 200000,
      maxTokens: 8192,
    },
    {
      id: "gpt-5.1-codex",
      name: "GPT-5.1 Codex (openai, via Setu)",
      api: "openai-completions",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 400000,
      maxTokens: 128000,
    },
    {
      id: "gpt-5",
      name: "GPT-5 (openai, via Setu)",
      api: "openai-completions",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 400000,
      maxTokens: 128000,
    },
    {
      id: "gpt-5-mini",
      name: "GPT-5 Mini (openai, via Setu)",
      api: "openai-completions",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 400000,
      maxTokens: 128000,
    },
    {
      id: "codex-mini-latest",
      name: "Codex Mini (openai, via Setu)",
      api: "openai-completions",
      reasoning: true,
      input: ["text"],
      contextWindow: 200000,
      maxTokens: 100000,
    },
    {
      id: "gemini-3-pro-preview",
      name: "Gemini 3 Pro (google, via Setu)",
      api: "openai-completions",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 1000000,
      maxTokens: 64000,
    },
    {
      id: "gemini-3-flash-preview",
      name: "Gemini 3 Flash (google, via Setu)",
      api: "openai-completions",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 1048576,
      maxTokens: 65536,
    },
    {
      id: "kimi-k2.5",
      name: "Kimi K2.5 (moonshot, via Setu)",
      api: "openai-completions",
      reasoning: true,
      input: ["text"],
      contextWindow: 262144,
      maxTokens: 262144,
    },
    {
      id: "glm-5",
      name: "GLM-5 (zai, via Setu)",
      api: "openai-completions",
      reasoning: true,
      input: ["text"],
      contextWindow: 204800,
      maxTokens: 131072,
    },
    {
      id: "MiniMax-M2.5",
      name: "MiniMax M2.5 (minimax, via Setu)",
      api: "openai-completions",
      reasoning: true,
      input: ["text"],
      contextWindow: 204800,
      maxTokens: 131072,
    },
  ];
}

export function buildProviderConfig(
  port: number = DEFAULT_PROXY_PORT,
): SetuProviderConfig {
  return {
    baseUrl: `http://localhost:${port}/v1`,
    apiKey: "setu-proxy-handles-auth",
    api: "openai-completions",
    authHeader: false,
    models: getDefaultModels(),
  };
}

export async function buildProviderConfigWithCatalog(
  port: number = DEFAULT_PROXY_PORT,
  baseURL: string = DEFAULT_BASE_URL,
): Promise<SetuProviderConfig> {
  const models = await fetchModelsFromCatalog(baseURL);
  return {
    baseUrl: `http://localhost:${port}/v1`,
    apiKey: "setu-proxy-handles-auth",
    api: "openai-completions",
    authHeader: false,
    models,
  };
}

export async function injectConfig(port: number = DEFAULT_PROXY_PORT): Promise<void> {
  const config = readOpenClawConfig();

  if (!config.models) config.models = {};
  const models = config.models as Record<string, unknown>;
  if (!models.providers) models.providers = {};
  const providers = models.providers as Record<string, unknown>;

  providers[PROVIDER_KEY] = await buildProviderConfigWithCatalog(port);

  writeOpenClawConfig(config);
}

export function removeConfig(): void {
  const config = readOpenClawConfig();

  const models = config.models as Record<string, unknown> | undefined;
  if (!models?.providers) return;
  const providers = models.providers as Record<string, unknown>;
  delete providers[PROVIDER_KEY];

  writeOpenClawConfig(config);
}

export function isConfigured(): boolean {
  const config = readOpenClawConfig();
  const models = config.models as Record<string, unknown> | undefined;
  if (!models?.providers) return false;
  const providers = models.providers as Record<string, unknown>;
  return PROVIDER_KEY in providers;
}

export function getConfigPath(): string {
  return OPENCLAW_CONFIG_PATH;
}
