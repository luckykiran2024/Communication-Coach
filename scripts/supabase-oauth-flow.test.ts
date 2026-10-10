import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runSupabaseGoogleSignIn, supabaseCallbackCode } from "../apps/mobile/src/supabase-oauth-flow";
import { installOAuthCrypto } from "../apps/mobile/src/oauth-crypto";
import { createClient } from "@supabase/supabase-js";

const redirect = "communicationcoach://oauth";
function fakeClient(options: { url?: string | null; exchangeError?: boolean } = {}) {
  const calls: string[] = [];
  const client = { auth: {
    async signInWithOAuth(input: { provider: string; options: { skipBrowserRedirect: boolean; redirectTo: string } }) {
      assert.equal(input.provider, "google");
      assert.equal(input.options.skipBrowserRedirect, true);
      assert.equal(input.options.redirectTo, redirect);
      calls.push("authorize");
      return { data: { url: options.url === undefined
        ? "https://project.supabase.co/auth/v1/authorize?code_challenge_method=s256" : options.url }, error: null };
    },
    async exchangeCodeForSession(code: string) {
      assert.equal(code, "one-time-code"); calls.push("exchange");
      return { data: { session: { access_token: "verified-session-token" } }, error: options.exchangeError ? new Error() : null };
    },
    async signOut(input: { scope: string }) { assert.equal(input.scope, "local"); calls.push("cleanup"); },
  } } as unknown as Pick<SupabaseClient, "auth">;
  return { client, calls };
}

test("supabase mobile: code callback is restricted to the exact app or web return address", () => {
  assert.equal(supabaseCallbackCode(`${redirect}?code=one-time-code`, redirect), "one-time-code");
  const web = "http://localhost:8092/oauth";
  assert.equal(supabaseCallbackCode(`${web}?code=one-time-code`, web), "one-time-code");
  for (const invalid of ["attacker://oauth?code=stolen", "communicationcoach://other?code=stolen",
    `${redirect}?code=first&code=second`, `${redirect}?error=access_denied&error_description=private-detail`,
    `${redirect}#access_token=token`, `${redirect}?code=`]) {
    assert.throws(() => supabaseCallbackCode(invalid, redirect));
  }
  assert.throws(() => supabaseCallbackCode("https://attacker.test/oauth?code=stolen", web));
});

test("supabase mobile: authorize, code exchange, API exchange, and local logout run in order", async () => {
  const { client, calls } = fakeClient();
  await runSupabaseGoogleSignIn(client, redirect, async () => ({ type: "success", url: `${redirect}?code=one-time-code` }),
    async token => { assert.equal(token, "verified-session-token"); calls.push("app-session"); });
  assert.deepEqual(calls, ["authorize", "exchange", "app-session", "cleanup"]);
});

test("supabase mobile: cancellation does not exchange or create an app session", async () => {
  for (const type of ["cancel", "dismiss"]) {
    const { client, calls } = fakeClient();
    await runSupabaseGoogleSignIn(client, redirect, async () => ({ type }), async () => assert.fail("Unexpected login"));
    assert.deepEqual(calls, ["authorize", "cleanup"]);
  }
});

test("supabase mobile: provider and PKCE exchange errors never create application sessions", async () => {
  for (const options of [{ url: null }, { exchangeError: true }]) {
    const { client, calls } = fakeClient(options);
    await assert.rejects(runSupabaseGoogleSignIn(client, redirect,
      async () => ({ type: "success", url: `${redirect}?code=one-time-code` }), async () => assert.fail("Unexpected login")));
    assert.equal(calls.at(-1), "cleanup");
  }
});

test("supabase mobile: unexpected callbacks and API failures still clear the temporary provider session", async () => {
  for (const callback of [`${redirect}?code=one-time-code`, "https://attacker.test/oauth?code=one-time-code"]) {
    const { client, calls } = fakeClient();
    await assert.rejects(runSupabaseGoogleSignIn(client, redirect, async () => ({ type: "success", url: callback }),
      async () => { throw new Error("Existing account needs password proof"); }));
    assert.equal(calls.at(-1), "cleanup");
  }
});

test("supabase mobile: plain PKCE is rejected before opening the browser", async () => {
  const { client, calls } = fakeClient({ url: "https://project.supabase.co/auth/v1/authorize?code_challenge_method=plain" });
  await assert.rejects(runSupabaseGoogleSignIn(client, redirect, async () => assert.fail("Browser must not open"),
    async () => assert.fail("Unexpected login")), /SHA-256/);
  assert.deepEqual(calls, ["authorize", "cleanup"]);
});

test("supabase mobile: native crypto adapter delegates securely without replacing browser WebCrypto", async () => {
  const target: { crypto?: Crypto } = {};
  const native = {
    getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    randomUUID: globalThis.crypto.randomUUID.bind(globalThis.crypto),
    digestSha256: (data: BufferSource) => globalThis.crypto.subtle.digest("SHA-256", data),
  };
  installOAuthCrypto(target, native);
  assert.equal(target.crypto!.getRandomValues, native.getRandomValues);
  const input = new TextEncoder().encode("OAuth challenge");
  assert.deepEqual(await target.crypto!.subtle.digest("SHA-256", input), await native.digestSha256(input));
  await assert.rejects(target.crypto!.subtle.digest("SHA-1", input), /Only SHA-256/);
  const browser = { crypto: globalThis.crypto };
  const original = browser.crypto.subtle;
  installOAuthCrypto(browser, native);
  assert.equal(browser.crypto.subtle, original);
});

test("supabase mobile: installed SDK produces S256 and exchanges the matching in-memory verifier", async () => {
  let challenge = "";
  let flowId = "";
  const client = createClient("https://project.supabase.co", "sb_publishable_test", {
    auth: { flowType: "pkce", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      if (String(input).includes("/token?grant_type=pkce")) {
        const body = JSON.parse(init?.body as string);
        assert.equal(body.auth_code, "one-time-code");
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.code_verifier));
        assert.equal(Buffer.from(digest).toString("base64url"), challenge);
        return Response.json({ access_token: "verified-session-token", refresh_token: "temporary-refresh-token",
          token_type: "bearer", expires_in: 3600, user: { id: "test-user" } });
      }
      assert.match(String(input), /\/logout\?scope=local$/);
      return new Response(null, { status: 204 });
    } },
  });
  let exchanged = false;
  await runSupabaseGoogleSignIn(client, redirect, async authorization => {
    const authorize = new URL(authorization);
    assert.equal(authorize.searchParams.get("provider"), "google");
    assert.equal(authorize.searchParams.get("code_challenge_method"), "s256");
    challenge = authorize.searchParams.get("code_challenge")!;
    flowId = new URL(authorize.searchParams.get("redirect_to")!).searchParams.get("sb_flow_id") ?? "";
    if (flowId) assert.match(flowId, /^[a-zA-Z0-9_-]{8,64}$/);
    return { type: "success", url: `${redirect}?code=one-time-code${flowId ? `&sb_flow_id=${flowId}` : ""}` };
  }, async token => { assert.equal(token, "verified-session-token"); exchanged = true; });
  assert.equal(exchanged, true);
});
