import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { IncomingMessage, ServerResponse } from "node:http";

export declare const app: FastifyInstance;
export declare const database: PrismaClient | null;
declare function handler(request: IncomingMessage, response: ServerResponse): Promise<void>;
export default handler;

