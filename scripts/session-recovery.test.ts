import { test } from "node:test";
import assert from "node:assert/strict";
import { SessionController } from "../apps/mobile/src/session-controller";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(overrides: Partial<ConstructorParameters<typeof SessionController<string>>[0]> = {}) {
  let stored: string | null = null;
  const session = new SessionController<string>({
    read: async () => stored, write: async token => { stored = token; },
    load: async token => `account:${token}`, expired: error => error instanceof Error && error.message === "expired", ...overrides,
  });
  return { session, stored: () => stored };
}

test("a delayed restore cannot replace a newer sign-in", async () => {
  const read = deferred<string | null>();
  const { session } = fixture({ read: () => read.promise });
  const restoring = session.restore();
  await session.authenticate(async () => ({ token: "new" }));
  read.resolve("old"); await restoring;
  assert.equal(session.snapshot().token, "new");
  assert.equal(session.snapshot().me, "account:new");
});

test("a delayed account response cannot resurrect a signed-out account", async () => {
  const profile = deferred<string>();
  const { session, stored } = fixture({ load: () => profile.promise });
  const login = session.authenticate(async () => ({ token: "old" }));
  await new Promise(resolve => setImmediate(resolve));
  await session.signOut(async () => undefined);
  profile.resolve("private account"); await login;
  assert.equal(session.snapshot().token, null); assert.equal(session.snapshot().me, null); assert.equal(stored(), null);
});

test("a pending login or OAuth result cannot reauthenticate after sign-out", async () => {
  const response = deferred<{ token: string }>(); const { session, stored } = fixture();
  const login = session.authenticate(() => response.promise);
  await session.signOut(async () => undefined);
  response.resolve({ token: "late" }); await assert.rejects(login, /cancelled/);
  assert.equal(session.snapshot().token, null); assert.equal(stored(), null);
});

test("expired stale refresh cannot sign a different account out", async () => {
  const old = deferred<string>(); let reads = 0;
  const { session } = fixture({ load: token => ++reads === 2 ? old.promise : Promise.resolve(`account:${token}`) });
  await session.authenticate(async () => ({ token: "first" }));
  const refresh = session.refresh();
  await session.authenticate(async () => ({ token: "second" }));
  old.reject(new Error("expired")); await refresh;
  assert.equal(session.snapshot().token, "second"); assert.equal(session.snapshot().error, "");
});

test("secure writes serialize so a late login write cannot survive sign-out", async () => {
  const pending = deferred<void>(); let stored: string | null = null;
  const { session } = fixture({ write: async token => { if (token) await pending.promise; stored = token; } });
  const login = session.authenticate(async () => ({ token: "first" }));
  await new Promise(resolve => setImmediate(resolve));
  const logout = session.signOut(async () => undefined);
  assert.equal(session.snapshot().token, null);
  pending.resolve(); await Promise.all([login, logout]);
  assert.equal(stored, null); assert.equal(session.snapshot().me, null);
});

test("offline sign-out clears local credentials and reports remote revocation uncertainty", async () => {
  const { session, stored } = fixture();
  await session.authenticate(async () => ({ token: "first" }));
  await session.signOut(async () => { throw new Error("offline"); });
  assert.equal(stored(), null); assert.equal(session.snapshot().token, null);
  assert.match(session.snapshot().error, /could not be revoked/);
});

test("failed global revocation and deletion preserve the session for retry", async () => {
  const { session, stored } = fixture();
  await session.authenticate(async () => ({ token: "first" }));
  await assert.rejects(session.confirmAndClear(async () => { throw new Error("offline"); }), /offline/);
  assert.equal(session.snapshot().token, "first"); assert.equal(stored(), "first");
});

test("confirmation from an old account never clears a new account", async () => {
  const action = deferred<void>(); const { session, stored } = fixture();
  await session.authenticate(async () => ({ token: "first" }));
  const deleting = session.confirmAndClear(() => action.promise);
  await session.authenticate(async () => ({ token: "second" }));
  action.resolve(); await deleting;
  assert.equal(session.snapshot().token, "second"); assert.equal(stored(), "second");
});

test("an offline restored session retains retry access and an expired one is removed", async () => {
  let offline = true;
  const { session, stored } = fixture({ read: async () => "saved", load: async () => { throw new Error(offline ? "offline" : "expired"); } });
  await session.restore(); assert.equal(session.snapshot().token, "saved"); assert.equal(session.snapshot().loading, false);
  assert.equal(session.snapshot().error, "offline");
  offline = false; await assert.rejects(session.refresh(), /expired/);
  assert.equal(session.snapshot().token, null); assert.equal(stored(), null);
});

test("secure storage failure blocks activation and cannot poison the next write", async () => {
  let fail = true;
  const { session } = fixture({ write: async () => { if (fail) throw new Error("device unavailable"); } });
  await assert.rejects(session.authenticate(async () => ({ token: "first" })), /secure sign-in storage/);
  assert.equal(session.snapshot().token, null);
  fail = false; await session.authenticate(async () => ({ token: "second" }));
  assert.equal(session.snapshot().me, "account:second");
});
