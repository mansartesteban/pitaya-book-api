import fastifyRequestLogger from "@mgcrea/fastify-request-logger"

import Fastify from "fastify"
import dotenv from "dotenv"
import cors from "@fastify/cors"
import userRoutes from "./routes/user.js"
import authPlugin from "./plugins/auth.js"
import authRoutes from "./routes/auth.js"
import accountRoutes from "./routes/account.js"
import adminClientRoutes from "./routes/admin/client.js"
import { superUser } from "./lib/security/superUser.js"
import fastifyJwt from "@fastify/jwt"

dotenv.config()

const app = Fastify({
  logger: {
    level: "debug",
    transport: {
      target: "@mgcrea/pino-pretty-compact",
      options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
    },
  },
  disableRequestLogging: true,
})

app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET,
})
app.register(fastifyRequestLogger)

await app.register(cors, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
})
await app.register(authPlugin)
await app.register(authRoutes, { prefix: "/auth" })
await app.register(userRoutes, { prefix: "/users" })
await app.register(accountRoutes, { prefix: "/account" })
await app.register(adminClientRoutes, {
  prefix: "/admin",
  preHandler: superUser,
})

app.listen({ port: Number(process.env.PORT) || 3000 }, (err, addr) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  app.log.info(`Server listening at ${addr}`)
})
