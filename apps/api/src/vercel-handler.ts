import type { IncomingMessage, ServerResponse } from "node:http";
import { app, database } from "./runtime";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await app.ready();
  const requestUrl = new URL(request.url ?? "/", "http://vercel.local");
  const originalPath = requestUrl.searchParams.get("__route");
  if (originalPath !== null) {
    requestUrl.searchParams.delete("__route");
    request.url = `/${originalPath}${requestUrl.search}`;
  } else {
    request.url = requestUrl.pathname.replace(/^\/api(?=\/|$)/, "") + requestUrl.search;
  }
  app.server.emit("request", request, response);
}

export { app, database };

