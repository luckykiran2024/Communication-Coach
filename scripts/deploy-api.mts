import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { deploymentDatabaseUrl } from "../apps/api/src/deployment-target.ts";

const apiRoot = fileURLToPath(new URL("../apps/api/", import.meta.url));
const certificatePath = fileURLToPath(new URL("../apps/api/prisma/supabase-ca.crt", import.meta.url));

try {
  const databaseUrl = deploymentDatabaseUrl(process.env, certificatePath);
  if (!databaseUrl) throw new Error("DATABASE_URL or the production database integration variable is required.");
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  if (process.argv.includes("--check-only")) {
    console.log("API deployment target configuration is valid; no migration or build was run.");
  } else {
    const npmCli = process.env.npm_execpath;
    if (!npmCli) throw new Error("Run this deployment through npm run deploy:vercel in the API workspace.");
    for (const args of [
      [npmCli, "run", "build", "-w", "@coach/core"],
      [npmCli, "run", "db:generate"],
      [npmCli, "run", "db:migrate"],
      [npmCli, "run", "build:vercel"],
      ["--input-type=module", "-e", "await import('./api/index.js'); console.log('API bootstrap import passed')"],
    ]) {
      const result = spawnSync(process.execPath, args, { cwd: apiRoot, env: { ...env, NODE_ENV: "production" }, stdio: "inherit" });
      if (result.error || result.status !== 0) throw new Error("API deployment step failed; see its preceding output.");
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "API deployment failed.");
  process.exitCode = 1;
}
