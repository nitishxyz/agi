// Cloudflare Worker handler to serve the install.sh file.
// We import the script as text via esbuild loader configured in infra/script.ts.

// @ts-expect-error - esbuild text loader returns a string at runtime
import SCRIPT from "../../scripts/install.sh";

export default {
  async fetch(_req: Request): Promise<Response> {
    return new Response(SCRIPT as unknown as string, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  },
};
