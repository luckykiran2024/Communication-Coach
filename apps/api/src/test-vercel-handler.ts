import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "./app";
import { prismaStore } from "./prisma-store";
import { testDatabaseUrl } from "./test-backend-config";

const certificatePath = fileURLToPath(new URL("../prisma/supabase-ca.crt", import.meta.url));
const database = new PrismaClient({ datasources: { db: { url: testDatabaseUrl(process.env, certificatePath) } } });
const app = await buildApp(prismaStore(database), {
  logger: true,
  origins: ["https://communication-coach-test-api-luckykiran2024s-projects.vercel.app"],
  managerEmails: [],
  oauth: { googleClientIds: [], microsoftClientIds: [] },
  devPlanId: "executive",
  billing: { enabled: false },
  voice: { enabled: false },
  email: { sender: null },
});

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
