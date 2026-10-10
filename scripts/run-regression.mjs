import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const tests = [
  "packages/core/test/*.test.ts",
  "apps/api/test/regression.test.ts",
  "apps/api/test/account-security.test.ts",
  "apps/api/test/assessment-store.test.ts",
  "apps/api/test/assessment.test.ts",
  "apps/api/test/conversation-phase.test.ts",
  "apps/api/test/serverless.test.ts",
  "apps/api/test/release-gates.test.ts",
  "apps/api/test/database-fixture.test.ts",
  "apps/api/test/runtime-env.test.ts",
  "apps/api/test/test-backend-config.test.ts",
  "apps/api/test/supabase-oauth.test.ts",
  "scripts/supabase-oauth-flow.test.ts",
  "scripts/cost-summary.test.ts",
  "scripts/realtime-events.test.ts",
];
const result = spawnSync(process.execPath, [
  "--require=./scripts/node-os-compat.cjs", "./node_modules/tsx/dist/cli.mjs", "--test", ...tests,
], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
