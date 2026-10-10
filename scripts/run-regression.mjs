import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const tests = [
  "packages/core/test/*.test.ts",
  "apps/api/test/regression.test.ts",
  "apps/api/test/account-security.test.ts",
];
const result = spawnSync(process.execPath, [
  "--require=./scripts/node-os-compat.cjs", "./node_modules/tsx/dist/cli.mjs", "--test", ...tests,
], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
