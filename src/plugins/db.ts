import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default fp(async (app) => {
  app.decorate("prisma", prisma);
});

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
