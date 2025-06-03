import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import bcrypt from "bcrypt";

const authRoutes: FastifyPluginAsync = async (app) => {
  // Register
  app.post("/register", async (req, reply) => {
    const bodySchema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
    });
    const data = bodySchema.parse(req.body);

    const hashed = await bcrypt.hash(data.password, 10);

    const user = await app.prisma.user.create({
      data: {
        email: data.email,
        password: hashed,
        name: data.name,
      },
    });

    return reply.code(201).send({ id: user.id, email: user.email });
  });

  // Login
  app.post("/login", async (req, reply) => {
    const bodySchema = z.object({
      email: z.string().email(),
      password: z.string(),
    });
    const data = bodySchema.parse(req.body);

    const user = await app.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) return reply.code(401).send({ error: "Invalid credentials" });

    const match = await bcrypt.compare(data.password, user.password);
    if (!match) return reply.code(401).send({ error: "Invalid credentials" });

    const token = app.jwt.sign({ id: user.id, email: user.email });
    return { token };
  });

  // Logout
  app.post("/logout", async (req, reply) => {
    // Pour le front, on renvoie juste un 200 OK
    return { message: "Logged out" };
  });
};

export default authRoutes;
