import { spawnSync } from "node:child_process";
const { CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY } = process.env;
if (!CLERK_PUBLISHABLE_KEY && !CLERK_SECRET_KEY) {
  console.log(
    "Clerk secrets not supplied; existing Worker secrets are unchanged.",
  );
  process.exit(0);
}
if (
  !CLERK_PUBLISHABLE_KEY?.startsWith("pk_live_") ||
  !CLERK_SECRET_KEY?.startsWith("sk_live_")
) {
  console.error("Production authentication requires both live Clerk keys.");
  process.exit(1);
}
// Send credentials via stdin, never shell arguments or logs.
const result = spawnSync(
  "npx",
  ["wrangler", "secret", "bulk", "--config", "dist/server/wrangler.json"],
  {
    input: JSON.stringify({ CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY }),
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
  },
);
if (result.status !== 0) {
  console.error(
    "Could not configure Clerk secrets. Check the deployment token permissions.",
  );
  process.exit(1);
}
console.log("Managed authentication secrets configured.");
