import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

// Runs only in the deployment job. Credentials remain in the runner environment.
const name = "resell-accounts";
function findDatabase() {
  const databases = JSON.parse(
    execFileSync("npx", ["wrangler", "d1", "list", "--json"], {
      encoding: "utf8",
    }),
  );
  return databases.find((database) => database.name === name);
}
let database = findDatabase();
if (!database) {
  execFileSync(
    "npx",
    ["wrangler", "d1", "create", name, "--no-update-config"],
    { stdio: "inherit" },
  );
  database = findDatabase();
}
if (!database?.uuid || !/^[a-f0-9-]{36}$/i.test(database.uuid))
  throw new Error("Could not resolve the account database ID.");
if (!process.env.GITHUB_ENV)
  throw new Error(
    "This bootstrap expects a GitHub Actions deployment environment.",
  );
appendFileSync(process.env.GITHUB_ENV, `RESELL_DATABASE_ID=${database.uuid}\n`);
console.log(`Account database ready: ${name} (${database.uuid})`);
