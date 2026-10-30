import { and, desc, eq, gte, lt, sql } from "drizzle-orm"
import { db } from "../../database/index.js"
import { qrCodes, qrOpenings } from "../../database/schema.js"
import { authenticationMiddleware, adminMiddleware } from "../../lib/middlewares/authentication.js"
import { qrFields, validId } from "./qr.validation.js"

export default async function qrRoutes(app) {
  app.get("/public/qr/:id", async (request, reply) => {
    reply.header("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate").header("X-Robots-Tag", "noindex, nofollow").header("Referrer-Policy", "no-referrer")
    if (!validId(request.params.id)) return reply.code(404).send("QR introuvable")
    const [qr] = await db.select().from(qrCodes).where(eq(qrCodes.id, request.params.id))
    if (!qr) return reply.code(404).send("QR introuvable")
    if (!qr.active) return reply.code(410).send("Ce QR code est désactivé")
    // HEAD checks never count as openings. No request metadata is persisted.
    if (request.method === "GET") await db.insert(qrOpenings).values({ qrId: qr.id })
    return reply.code(302).header("Location", qr.destination).send()
  })
  app.register(async (admin) => {
    admin.addHook("preHandler", authenticationMiddleware)
    admin.addHook("preHandler", adminMiddleware)
    admin.addHook("onRequest", async (_request, reply) => { reply.header("Cache-Control", "no-store") })
    admin.get("/", async () => db.select().from(qrCodes).orderBy(desc(qrCodes.updatedAt)))
    admin.post("/", async (request, reply) => {
      let fields
      try { fields = qrFields(request.body) } catch (error) { return reply.code(400).send({ error: error.message }) }
      const [row] = await db.insert(qrCodes).values(fields).returning()
      return reply.code(201).send(row)
    })
    admin.put("/:id", async (request, reply) => {
      if (!validId(request.params.id)) return reply.code(400).send({ error: "Identifiant invalide" })
      let fields
      try { fields = qrFields(request.body) } catch (error) { return reply.code(400).send({ error: error.message }) }
      const [row] = await db.update(qrCodes).set({ ...fields, updatedAt: new Date() }).where(eq(qrCodes.id, request.params.id)).returning()
      return row || reply.code(404).send({ error: "QR introuvable" })
    })
    admin.get("/stats", async (request, reply) => {
      const { from, to, group = "day", id } = request.query
      const start = new Date(from), end = new Date(to)
      if (![from, to].every(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) || !["day", "week", "month"].includes(group) || !Number.isFinite(+start) || !Number.isFinite(+end) || start.toISOString().slice(0, 10) !== from || end.toISOString().slice(0, 10) !== to || end <= start || end - start > 366 * 86400000 || (id && !validId(id))) return reply.code(400).send({ error: "Période invalide (366 jours maximum)" })
      const condition = and(gte(qrOpenings.openedAt, sql`${from}::date::timestamp AT TIME ZONE 'Europe/Paris'`), lt(qrOpenings.openedAt, sql`${to}::date::timestamp AT TIME ZONE 'Europe/Paris'`), id ? eq(qrOpenings.qrId, id) : undefined)
      // Literal is restricted to the whitelist above; repeated parameters would
      // make PostgreSQL treat SELECT and GROUP BY as different expressions.
      const bucket = sql`date_trunc(${sql.raw(`'${group}'`)}, ${qrOpenings.openedAt} AT TIME ZONE 'Europe/Paris')`
      const totals = await db.select({ qrId: qrOpenings.qrId, period: bucket, count: sql`count(*)::integer` }).from(qrOpenings).where(condition).groupBy(qrOpenings.qrId, bucket).orderBy(bucket)
      const events = id ? await db.select({ openedAt: qrOpenings.openedAt }).from(qrOpenings).where(condition).orderBy(desc(qrOpenings.openedAt)).limit(200) : []
      return { totals, events }
    })
  }, { prefix: "/qr-codes" })
}
