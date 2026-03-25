import dotenv from "dotenv"
import Fastify from "fastify"
import fastifyJwt from "@fastify/jwt"
import cors from "@fastify/cors"
import fastifyRequestLogger from "@mgcrea/fastify-request-logger"
import multipart from "@fastify/multipart"
import util from "node:util"
import fastifyCookie from "@fastify/cookie"
import { registerErrorHandler } from "./lib/middlewares/errorHandler.js"
import routes from "./modules/routes.js"

dotenv.config()

const LOG_DEBUG = 0b00000001
const LOG_TRACE = 0b00000010
const LOG_INFO = 0b00000100
const LOG_WARN = 0b00001000
const LOG_ERROR = 0b00010000
const LOG_FATAL = 0b00100000

const LEVEL_LABEL = {
  [LOG_DEBUG]: "DEBUG",
  [LOG_TRACE]: "TRACE",
  [LOG_INFO]: "INFO",
  [LOG_WARN]: "WARN",
  [LOG_ERROR]: "ERROR",
  [LOG_FATAL]: "FATAL",
}

const createLogger = (context = "", options = { level: LOG_INFO }) => {
  const logMethod = (level, ...args) => {
    if (!shouldLog(level)) {
      return
    }
    // const prefix = context ? `[${context}]` : ""
    const stack = new Error().stack
      ?.split("\n")
      .slice(2, 3) // prends la ligne appelant la méthode
      .join("")
      .trim()
    const msg = args
      .map((a) =>
        typeof a === "object" ? util.inspect(a, { depth: 3, colors: true }) : a
      )
      .join(" ")
    console.log(`${LEVEL_LABEL[level]} ${msg} ${stack}`)
  }

  const shouldLog = (lvl) => {
    return (options.level & lvl) !== 0
  }

  return {
    debug: (...args) => logMethod(LOG_DEBUG, ...args),
    info: (...args) => logMethod(LOG_INFO, ...args),
    warn: (...args) => logMethod(LOG_WARN, ...args),
    error: (...args) => logMethod(LOG_ERROR, ...args),
    fatal: (...args) => logMethod(LOG_FATAL, ...args),
    trace: (...args) => logMethod(LOG_TRACE, ...args),
    child: (childContext = "") =>
      createLogger(
        context ? `${context}:${childContext}` : childContext,
        options
      ),
  }
}

const app = Fastify({
  loggerInstance: createLogger("app", {
    level: LOG_ERROR | LOG_FATAL | LOG_WARN | LOG_INFO | LOG_DEBUG,
  }),
  // logger: {
  //   level: "debug",
  //   transport: {
  //     target: "@mgcrea/pino-pretty-compact",
  //     options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
  //   },
  // },
  disableRequestLogging: true,
})

app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET,
  cookie: {
    cookieName: "access_token",
    signed: false, // true si tu veux signer le cookie, sinon false
  },
})
app.register(fastifyCookie)
app.register(fastifyRequestLogger)
app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
})

await app.register(cors, {
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
})

registerErrorHandler(app)
routes(app).then(() => {
  app.listen(
    { host: "0.0.0.0", port: Number(process.env.PORT) || 3000 },
    (err, addr) => {
      if (err) {
        app.log.error(err)
        process.exit(1)
      }

      app.log.info(`Server listening at ${addr}`)
    }
  )
})
