import crypto from "node:crypto"
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm"
import { db } from "../../../database/index.js"
import { galleryViewEvents } from "../../../database/schema.js"
import { confirmedUser, visibleTarget } from "../interactions/interaction.routes.js"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const cookieName = "pitaya_audience"
const retentionMs = 30 * 24 * 60 * 60 * 1000

export async function cleanupGalleryViews() {
  await db.delete(galleryViewEvents).where(lt(galleryViewEvents.createdAt, new Date(Date.now() - retentionMs)))
}

export default function galleryStatsRoutes(fastify) {
  fastify.delete("/visitor", async (_request, reply) => {
    reply.clearCookie(cookieName, { path: "/" })
    return reply.code(204).send()
  })
  fastify.post("/:galleryId/view", async (request, reply) => {
    const { galleryId } = request.params
    const photoId = request.body?.photoId || null
    if (!uuid.test(galleryId) || (photoId && !uuid.test(photoId))) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    if (!await visibleTarget(request, galleryId, photoId)) return reply.code(404).send({ success: false, message: "Galerie ou photo introuvable" })
    let audienceId = request.cookies?.[cookieName]
    if (typeof audienceId !== "string" || !/^[0-9a-f]{32}$/.test(audienceId)) audienceId = crypto.randomBytes(16).toString("hex")
    reply.setCookie(cookieName, audienceId, { httpOnly: true, sameSite: "lax",
      secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 24 * 60 * 60 })
    const visitorHash = crypto.createHmac("sha256", process.env.JWT_SECRET)
      .update(`${galleryId}:${audienceId}`).digest("hex")
    const [recent] = await db.select({ id: galleryViewEvents.id }).from(galleryViewEvents)
      .where(and(eq(galleryViewEvents.galleryId, galleryId), photoId ? eq(galleryViewEvents.photoId, photoId) : isNull(galleryViewEvents.photoId),
        eq(galleryViewEvents.visitorHash, visitorHash), gt(galleryViewEvents.createdAt, new Date(Date.now() - 60 * 1000))))
      .limit(1)
    if (recent) return reply.send({ success: true })
    const account = await confirmedUser(request)
    await db.insert(galleryViewEvents).values({ galleryId, photoId, visitorHash, userId: account?.id || null })
    return reply.send({ success: true })
  })
}
