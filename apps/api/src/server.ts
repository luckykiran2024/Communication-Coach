import { database, app } from "../api/index.js";
import { z } from "zod";

const { PORT, HOST } = z.object({ PORT: z.coerce.number().int().min(1).max(65535).default(4000), HOST: z.string().default("127.0.0.1") }).parse(process.env);

for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, async () => { await app.close(); if (database) await database.$disconnect(); });
await app.listen({ port: PORT, host: HOST });

