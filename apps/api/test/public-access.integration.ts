import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (process.env.DATABASE_ACCESS_AUDIT_CONFIRMED !== "true") {
  throw new Error("Explicit DATABASE_ACCESS_AUDIT_CONFIRMED=true is required for live read-only ACL verification.");
}
const url = new URL(process.env.DATABASE_URL ?? "");
if (!url.hostname.endsWith(".supabase.com") || !url.username.includes("nrrmhftccqsofjvoaffm")
  || (url.searchParams.get("schema") ?? "public") !== "public") {
  throw new Error("Use only the approved Supabase project's public-schema audit connection.");
}
const database = new PrismaClient({ datasources: { db: { url: url.toString() } } });
after(() => database.$disconnect());
const migrationPath = "../prisma/migrations/202610101500_public_data_api_lockdown/migration.sql";
const migration = readFileSync(new URL(migrationPath, import.meta.url), "utf8");
const expectedTables = ["AuthSession", "Conversation", "ConversationTurn", "CustomScenario", "CustomScenarioRevision",
  "Entitlement", "OAuthIdentity", "PurchaseIntent", "UsageReservation", "User", "UserProfile", "VoiceSession", "_prisma_migrations"];

test("live access: every public table has RLS and no API-role table or column privileges", async () => {
  const result = await database.$transaction(async transaction => {
    await transaction.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    return transaction.$queryRaw<Array<{ name: string; rls: boolean; role: string; exposed: boolean }>>`
      SELECT tables.relname AS name, tables.relrowsecurity AS rls, roles.rolname AS role,
        (has_any_column_privilege(roles.oid,tables.oid,'SELECT')
          OR has_any_column_privilege(roles.oid,tables.oid,'INSERT')
          OR has_any_column_privilege(roles.oid,tables.oid,'UPDATE')
          OR has_any_column_privilege(roles.oid,tables.oid,'REFERENCES')
          OR has_table_privilege(roles.oid,tables.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS exposed
      FROM pg_class tables JOIN pg_namespace namespaces ON namespaces.oid=tables.relnamespace CROSS JOIN pg_roles roles
      WHERE namespaces.nspname='public' AND tables.relkind IN ('r','p') AND roles.rolname IN ('anon','authenticated')
    `;
  });
  assert.equal(result.length, expectedTables.length * 2);
  assert.deepEqual([...new Set(result.map(row => row.name))].sort(), [...expectedTables].sort());
  assert.ok(result.every(row => row.rls && !row.exposed));
});

for (const role of ["anon", "authenticated"] as const) {
  test(`live access: ${role} zero-row reads are denied on all 13 public tables`, async () => {
    for (const table of expectedTables) {
      await assert.rejects(database.$transaction(async transaction => {
        await transaction.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        await transaction.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
        await transaction.$queryRawUnsafe(`SELECT 1 FROM public."${table}" WHERE false`);
      }), (error: unknown) => {
        const failure = error as { meta?: { code?: string } };
        return failure.meta?.code === "42501";
      });
    }
  });
}

test("live access: owner can still read without customer rows and postgres-created tables default private", async () => {
  await database.$transaction(async transaction => {
    await transaction.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    assert.deepEqual(await transaction.$queryRaw`SELECT 1 FROM public."User" WHERE false`, []);
    const grants = await transaction.$queryRaw<Array<{ remaining: number }>>`
      SELECT count(*)::int AS remaining FROM pg_default_acl defaults
      CROSS JOIN LATERAL aclexplode(defaults.defaclacl) grants
      WHERE defaults.defaclrole=current_user::regrole AND defaults.defaclobjtype IN ('r','S')
        AND defaults.defaclnamespace IN (0, 'public'::regnamespace)
        AND (grants.grantee=0 OR pg_get_userbyid(grants.grantee) IN ('anon','authenticated'))
    `;
    assert.equal(grants[0].remaining, 0);
  });
});

test("live access: the public-only migration leaves both isolated schemas unchanged", async () => {
  for (const schema of ["coach_apk_test", "coach_verification"]) {
    await database.$transaction(async transaction => {
      await transaction.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const snapshot = () => transaction.$queryRaw`
        SELECT namespaces.nspname, tables.relname, tables.relrowsecurity, tables.relforcerowsecurity, tables.relacl::text
        FROM pg_class tables JOIN pg_namespace namespaces ON namespaces.oid=tables.relnamespace
        WHERE namespaces.nspname IN ('public','coach_apk_test','coach_verification') AND tables.relkind IN ('r','p')
        ORDER BY namespaces.nspname, tables.relname
      `;
      const before = await snapshot();
      await transaction.$executeRawUnsafe(`SET LOCAL search_path = "${schema}"`);
      await transaction.$executeRawUnsafe(migration);
      assert.deepEqual(await snapshot(), before);
    });
  }
});
