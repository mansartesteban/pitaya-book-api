import Fastify from "fastify";
import dotenv from "dotenv";
import cors from "@fastify/cors";
import userRoutes from "./routes/user";
import dbPlugin from "./plugins/db";
import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import accountRoutes from "./routes/account";

dotenv.config();

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});
await app.register(authPlugin);
await app.register(dbPlugin);
await app.register(authRoutes, { prefix: "/auth" });
await app.register(userRoutes, { prefix: "/users" });
await app.register(accountRoutes, { prefix: "/account" });

app.listen({ port: Number(process.env.PORT) || 3000 }, (err, addr) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Server listening at ${addr}`);
});
