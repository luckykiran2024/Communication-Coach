import type { IncomingMessage, ServerResponse } from "node:http";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const runtime = await import("../src/vercel-handler");
    return await runtime.default(request, response);
  } catch (error) {
    console.error("C2Coach API bootstrap failed", error);
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ error: "API startup failed.", detail: error instanceof Error ? error.message : "Unknown startup failure" }));
  }
}
