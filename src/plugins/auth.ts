import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";

export default fp(async (fastify) => {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "changeme",
  });

  fastify.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: any;
  }

  interface FastifyRequest {
    user: { id: number; email: string; password: string; name: string };
  }
}
