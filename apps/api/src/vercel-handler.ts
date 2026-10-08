import type { IncomingMessage, ServerResponse } from "node:http";
import { app, database } from "./runtime";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await app.ready();
  request.url = request.url?.replace(/^\/api(?=\/|\?|$)/, "") || "/";
  app.server.emit("request", request, response);
}

export { app, database };

