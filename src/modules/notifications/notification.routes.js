import { and, desc, eq, isNull } from "drizzle-orm"
import { db } from "../../database/index.js"
import { adminNotifications } from "../../database/schema.js"
import { authenticationMiddleware } from "../../lib/middlewares/authentication.js"

export default function notificationRoutes(fastify) {
  fastify.addHook("preHandler", authenticationMiddleware)
  fastify.get("/", async (request, reply) => {
    const notifications = await db.select({
      id: adminNotifications.id, title: adminNotifications.title, body: adminNotifications.body,
      kind: adminNotifications.kind,
      galleryId: adminNotifications.galleryId, createdAt: adminNotifications.createdAt,
      readAt: adminNotifications.readAt,
    }).from(adminNotifications)
      .where(eq(adminNotifications.ownerUserId, request.user.id))
      .orderBy(desc(adminNotifications.createdAt)).limit(50)
    return reply.send({ success: true, data: notifications })
  })
  fastify.patch("/:notificationId/read", async (request, reply) => {
    const id = request.params.notificationId
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    }
    const [updated] = await db.update(adminNotifications).set({ readAt: new Date() })
      .where(and(eq(adminNotifications.id, id), eq(adminNotifications.ownerUserId, request.user.id), isNull(adminNotifications.readAt)))
      .returning({ id: adminNotifications.id })
    return reply.send({ success: true, data: { updated: !!updated } })
  })
}
