import { createSetuFetch, createWalletContext } from "@ottocode/ai-sdk";
import { loadWallet } from "./wallet.ts";

const DEFAULT_PORT = 8403;
const DEFAULT_BASE_URL = "https://api.setu.ottocode.io";

export interface ProxyOptions {
  port?: number;
  baseURL?: string;
  verbose?: boolean;
}

export function createProxy(options: ProxyOptions = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const baseURL = options.baseURL ?? DEFAULT_BASE_URL;
  const verbose = options.verbose ?? false;

  const wallet = loadWallet();
  if (!wallet) {
    throw new Error(
      "No wallet found. Run `openclaw-setu setup` or `openclaw-setu wallet generate` first.",
    );
  }

  const log = verbose
    ? (msg: string) => console.log(`[setu-proxy] ${msg}`)
    : (_msg: string) => {};

  const walletCtx = createWalletContext({ privateKey: wallet.privateKey });

  const setuFetch = createSetuFetch({
    wallet: walletCtx,
    baseURL,
    callbacks: {
      onPaymentRequired: (amountUsd) => {
        log(`Payment required: $${amountUsd.toFixed(4)}`);
      },
      onPaymentComplete: (data) => {
        log(
          `Payment complete: $${data.amountUsd.toFixed(4)} | balance: $${data.newBalance.toFixed(4)}`,
        );
      },
      onPaymentError: (error) => {
        console.error(`[setu-proxy] Payment error: ${error}`);
      },
      onBalanceUpdate: (update) => {
        log(
          `Cost: $${update.costUsd.toFixed(4)} | remaining: $${update.balanceRemaining.toFixed(4)}`,
        );
      },
    },
  });

  const proxyBaseURL = baseURL;

  const server = Bun.serve({
    port,
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);

      if (url.pathname === "/health") {
        return Response.json({
          status: "ok",
          wallet: wallet.publicKey,
          provider: "setu",
        });
      }

      if (url.pathname === "/v1/models") {
        log("GET /v1/models");
        const resp = await setuFetch(`${proxyBaseURL}/v1/models`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        return new Response(resp.body, {
          status: resp.status,
          headers: {
            "Content-Type":
              resp.headers.get("Content-Type") ?? "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      const isCompletions = url.pathname === "/v1/chat/completions";
      const isResponses = url.pathname === "/v1/responses";
      if (!isCompletions && !isResponses) {
        const targetURL = `${proxyBaseURL}${url.pathname}`;
        log(`Proxying ${req.method} ${url.pathname}`);
        const resp = await setuFetch(targetURL, {
          method: req.method,
          headers: { "Content-Type": "application/json" },
          body: req.method !== "GET" ? await req.text() : undefined,
        });
        return new Response(resp.body, {
          status: resp.status,
          headers: {
            "Content-Type":
              resp.headers.get("Content-Type") ?? "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      const body = await req.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(body);
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const model = parsed.model as string;
      const stream = parsed.stream as boolean;
      log(
        `${isCompletions ? "POST /v1/chat/completions" : "POST /v1/responses"} model=${model} stream=${stream}`,
      );

      const targetURL = `${proxyBaseURL}${url.pathname}`;
      const resp = await setuFetch(targetURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (stream && resp.body) {
        return new Response(resp.body, {
          status: resp.status,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      return new Response(resp.body, {
        status: resp.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    },
  });

  return { server, port, wallet };
}
