import { createServer, request as proxyRequest } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { assessmentRubrics } from "@coach/core";
import { buildApp } from "../apps/api/src/app";
import { MemoryStore } from "../apps/api/src/memory-store";
import type { AccountEmail } from "../apps/api/src/email-sender";
import { coachingReviewFixture, priorityCoachingFixture } from "../packages/core/test/coaching-review.fixture";
import { functionalPreviewNotice, requireFunctionalPreview } from "./functional-preview-config";

requireFunctionalPreview();
const emails: AccountEmail[] = [];
const store = new MemoryStore();
let assessmentCalls = 0;
const webRoot = resolve("artifacts/functional-web");
const app = await buildApp(store, {
  devPlanId: "executive", rateLimitMax: 500, origins: ["http://127.0.0.1:4311", "http://localhost:4311", "http://10.0.2.2:4311"],
  email: { sender: { async send(email) { emails.push(email); } }, linkBaseUrl: "http://127.0.0.1:4311" },
  billing: { enabled: false }, voice: { enabled: false, apiKey: "" },
  assessment: { enabled: true, apiKey: "", model: "INJECTED-FUNCTIONAL-TEST-NOT-LIVE-AI", provider: {
    async assess(input) {
      assessmentCalls += 1;
      if (assessmentCalls === 1) throw new Error("Deliberate first-review failure to verify explicit recovery");
      const retry = input.turns.find(turn => turn.role === "user" && turn.phase === "independent_retry");
      if (!retry) throw new Error("Retry evidence required");
      const quote = retry.text.slice(0, 300);
      return { value: {
        rubricVersion: assessmentRubrics[input.scenario.module].version, modelVersion: input.model, audioAssessed: false,
        transferResult: "partial", coachingReview: coachingReviewFixture(retry.id, quote),
        priorities: [{ observation: "Authored fixture: check that your recommendation explains the changed constraint.",
          quote, turnId: retry.id, confidence: "medium", nextExercise: "Explain a different constraint and a practical next step.",
          coaching: priorityCoachingFixture }],
      }, inputTokens: 0, outputTokens: 0, costMicros: 0 };
    },
  } },
});
app.addHook("onResponse", async (request, reply) => {
  console.log(JSON.stringify({ method: request.method, path: request.url.split("?")[0], status: reply.statusCode }));
});
app.get("/__test/mailbox", async () => ({ emails }));
app.get("/__test/status", async () => ({ fixture: true, assessmentCalls, emailCount: emails.length }));
await app.listen({ port: 4310, host: "127.0.0.1" });

const types: Record<string, string> = {
  ".js": "application/javascript", ".json": "application/json", ".css": "text/css", ".html": "text/html",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf",
};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1:4311").pathname;
  if (pathname.startsWith("/api/")) {
    const upstream = proxyRequest({ host: "127.0.0.1", port: 4310, method: request.method,
      path: (request.url ?? "").slice(4), headers: { ...request.headers, host: "127.0.0.1:4310" } }, result => {
      response.writeHead(result.statusCode ?? 502, result.headers); result.pipe(response);
    });
    upstream.on("error", () => { response.writeHead(502); response.end("Local test API unavailable"); });
    request.pipe(upstream); return;
  }
  try {
    let file = resolve(webRoot, `.${decodeURIComponent(pathname)}`);
    if (relative(webRoot, file).startsWith("..")) { response.writeHead(403); response.end(); return; }
    if (!extname(file) || (await stat(file).catch(() => null))?.isDirectory()) file = resolve(webRoot, "index.html");
    let body = await readFile(file);
    if (extname(file) === ".html") {
      const notice = `<div style="position:fixed;top:0;z-index:99999;background:#fff3bf;color:#18213a;`
        + `font:12px system-ui;padding:6px;pointer-events:none">${functionalPreviewNotice}</div>`;
      body = Buffer.from(body.toString().replace("<body>", `<body>${notice}`));
    }
    response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(body);
  } catch { response.writeHead(404); response.end("Local fixture asset not found"); }
});
server.listen(4311, "127.0.0.1", () => console.log("FUNCTIONAL_TEST_URL=http://127.0.0.1:4311"));
for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => {
  server.close(); void app.close();
});
