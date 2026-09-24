import vinext from "vinext";
import { defineConfig } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const devHost = process.env.DEV_HOST;

const localBindingConfig = {
  main: "./worker/index.ts",
  name: "reainvent",
  d1_databases: [
    {
      binding: "TREND_DB",
      database_name: "resell-accounts",
      database_id: "0eba5063-9ff7-40c0-83f7-f1b79dca503f",
      migrations_dir: "./migrations/trends",
    },
  ],
  compatibility_flags: ["nodejs_compat"],
  routes: [{ pattern: "reainvent.com", custom_domain: true }],
  assets: { binding: "ASSETS", run_worker_first: true },
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      allowedHosts: ["claude-superfund.shitposting.ts.net"],
      ...(devHost ? { host: devHost } : {}),
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
