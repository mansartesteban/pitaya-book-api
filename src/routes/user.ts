import { FastifyPluginAsync } from "fastify";
import { UserWithValidationSchema } from "../schemas/user.schema";

const userRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (req, res) => {
    return app.prisma.user.findMany();
  });

  app.post("/", async (req, res) => {
    const body = UserWithValidationSchema.parse(req.body);
    return app.prisma.user.create({ data: body });
  });

  app.delete<{
    Params: { id: string };
  }>("/:id", async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "Invalid user ID" });
    }

    const user = await app.prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    await app.prisma.user.delete({ where: { id } });
    return reply.code(204).send(); // No content
  });
};

export default userRoutes;
