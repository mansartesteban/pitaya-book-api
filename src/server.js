import { registerErrorHandler } from "./lib/middlewares/errorHandler"
import dotenv from "dotenv"
import Fastify from "fastify"
import fastifyJwt from "@fastify/jwt"
import cors from "@fastify/cors"
import fastifyRequestLogger from "@mgcrea/fastify-request-logger"
import routes from "@/modules/routes"

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
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
})

registerErrorHandler(app)
routes(app).then(() => {
  app.listen({ port: Number(process.env.PORT) || 3000 }, (err, addr) => {
    if (err) {
      app.log.error(err)
      process.exit(1)
    }

    console.log("then", app.printRoutes())
    app.log.info(`Server listening at ${addr}`)
  })
})
