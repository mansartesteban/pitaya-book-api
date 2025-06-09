import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import bcrypt from "bcrypt";
import fastifyOauth2 from "@fastify/oauth2";

const authRoutes: FastifyPluginAsync = async (app) => {
  // Register
  app.post("/register", async (req, reply) => {
    const bodySchema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      firstname: z.string().min(1),
      lastname: z.string().min(1),
    });

    try {
      const data = bodySchema.parse(req.body);

      const hashed = await bcrypt.hash(data.password, 10);

      const user = await app.prisma.user.create({
        data: {
          email: data.email,
          password: hashed,
          firstname: data.firstname,
          lastname: data.lastname,
        },
      });

      return reply.code(201).send({ id: user.id, email: user.email });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          error: "Validation failed",
          issues: err.errors, // tableau détaillé des erreurs
        });
      }

      // autre erreur (ex: DB, bcrypt, etc.)
      console.error(err);
      return reply.code(500).send({ error: "Internal server error" });
    }
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

    const token = app.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    return { token };
  });

  // Logout
  app.post("/logout", async (req, reply) => {
    // Pour le front, on renvoie juste un 200 OK
    return { message: "Logged out" };
  });

  app.get("/api/google/callback", async (req, reply) => {
    const token =
      await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
    const userInfo = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token.token.access_token}`,
        },
      }
    ).then((res) => res.json());

    // Vérifie si utilisateur existe ou crée un nouveau
    const user = await app.prisma.user.upsert({
      where: { email: userInfo.email },
      update: { lastLoginAt: new Date() },
      create: {
        email: userInfo.email,
        firstname: userInfo.given_name ?? "",
        lastname: userInfo.family_name ?? "",
        password: null,
        clientType: "INDIVIDUAL",
        isActive: true,
      },
    });

    // Crée et renvoie un token de session
    const sessionToken = app.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    reply.redirect(
      `http://localhost:5173/auth/login-success?token=${sessionToken}`
    );
  });

  app.register(fastifyOauth2, {
    name: "googleOAuth2",
    scope: ["email", "profile"],
    credentials: {
      client: {
        id: process.env.GOOGLE_CLIENT_ID,
        secret: process.env.GOOGLE_CLIENT_SECRET,
      },
      auth: fastifyOauth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: "/api/google",
    callbackUri: "http://localhost:3000/auth/api/google/callback",
  });
};

export default authRoutes;
