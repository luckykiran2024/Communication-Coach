import type { IncomingMessage, ServerResponse } from "node:http";

let runtimePromise: Promise<typeof import("./runtime")> | undefined;

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    runtimePromise ??= import("./runtime");
    const { app } = await runtimePromise;
    await app.ready();
    const requestUrl = new URL(request.url ?? "/", "http://vercel.local");
    const originalPath = requestUrl.searchParams.get("__route");
    if (originalPath !== null) {
      requestUrl.searchParams.delete("__route");
      request.url = `/${originalPath}${requestUrl.search}`;
    } else {
      request.url = requestUrl.pathname.replace(/^\\/api(?=\\/|$)/, "") + requestUrl.search;
    }
    app.server.emit("request", request, response);
  } catch (error) {
    console.error("C2Coach API bootstrap failed", error);
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ error: "API startup failed." }));
  }
}
