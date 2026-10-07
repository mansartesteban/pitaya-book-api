import { and, eq, gte, ilike, inArray, sql } from "drizzle-orm"
import { db } from "../../database/index.js"
import { companyContacts, galleries, galleryInteractions, galleryManagerGrants, galleryViewEvents, photos, users } from "../../database/schema.js"
import { authenticationMiddleware } from "../../lib/middlewares/authentication.js"
import { signPhotoUrl } from "../../lib/utils/Photo.js"
import fs from "node:fs/promises"
import path from "node:path"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function canManage(userId, galleryId) {
  const [account] = await db.select({ email: users.email, emailConfirmed: users.emailConfirmed, isActive: users.isActive })
    .from(users).where(eq(users.id, userId))
  if (!account?.isActive || !account.emailConfirmed) return false
  const [owned] = await db.select({ id: galleries.id }).from(galleries)
    .where(and(eq(galleries.id, galleryId), eq(galleries.ownerUserId, userId)))
  if (owned) return true
  const [grant] = await db.select({ id: galleryManagerGrants.id }).from(galleryManagerGrants)
    .innerJoin(galleries, eq(galleryManagerGrants.galleryId, galleries.id))
    .innerJoin(companyContacts, eq(galleryManagerGrants.contactId, companyContacts.id))
    .where(and(eq(galleries.id, galleryId), eq(galleries.clientCompanyId, companyContacts.companyId), ilike(companyContacts.email, account.email)))
  return !!grant
}

export default function memberRoutes(fastify) {
  fastify.addHook("preHandler", authenticationMiddleware)

  fastify.get("/galleries/:galleryId/stats", async (request, reply) => {
    const { galleryId } = request.params
    if (!uuid.test(galleryId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    if (!await canManage(request.user.id, galleryId)) return reply.code(403).send({ success: false, message: "Accès non autorisé" })
    const [views] = await db.select({
      galleryViews: sql`count(*) filter (where ${galleryViewEvents.photoId} is null)`,
      photoViews: sql`count(*) filter (where ${galleryViewEvents.photoId} is not null)`,
      registeredVisitors: sql`count(distinct ${galleryViewEvents.userId})`,
      guestVisitors: sql`count(distinct ${galleryViewEvents.visitorHash}) filter (where ${galleryViewEvents.userId} is null)`,
    }).from(galleryViewEvents).where(and(eq(galleryViewEvents.galleryId, galleryId),
      gte(galleryViewEvents.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))))
    const [interactions] = await db.select({
      reactions: sql`count(*) filter (where ${galleryInteractions.kind} = 'REACTION' and ${galleryInteractions.status} = 'PUBLISHED')`,
      comments: sql`count(*) filter (where ${galleryInteractions.kind} = 'COMMENT' and ${galleryInteractions.status} = 'PUBLISHED')`,
    }).from(galleryInteractions).where(eq(galleryInteractions.galleryId, galleryId))
    return reply.send({ success: true, data: {
      galleryViews: Number(views.galleryViews), photoViews: Number(views.photoViews),
      registeredVisitors: Number(views.registeredVisitors), guestVisitors: Number(views.guestVisitors),
      reactions: Number(interactions.reactions), comments: Number(interactions.comments),
    } })
  })

  fastify.get("/galleries/:galleryId/photos", async (request, reply) => {
    const { galleryId } = request.params
    if (!uuid.test(galleryId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    if (!await canManage(request.user.id, galleryId)) return reply.code(403).send({ success: false, message: "Accès non autorisé" })
    const rows = await db.select({ id: photos.id, extension: photos.extension, isHidden: photos.isHidden, galleryId: photos.galleryId })
      .from(photos).where(eq(photos.galleryId, galleryId))
    return reply.send({ success: true, data: rows.map((photo) => ({
      id: photo.id, isHidden: photo.isHidden, thumbnailUrl: signPhotoUrl(photo, true, 300),
    })) })
  })

  fastify.patch("/galleries/:galleryId/photos/:photoId/visibility", async (request, reply) => {
    const { galleryId, photoId } = request.params
    if (!uuid.test(galleryId) || !uuid.test(photoId) || typeof request.body?.hidden !== "boolean") {
      return reply.code(400).send({ success: false, message: "Demande invalide" })
    }
    if (!await canManage(request.user.id, galleryId)) return reply.code(403).send({ success: false, message: "Accès non autorisé" })
    const [updated] = await db.update(photos).set({ isHidden: request.body.hidden })
      .where(and(eq(photos.id, photoId), eq(photos.galleryId, galleryId)))
      .returning({ id: photos.id, isHidden: photos.isHidden })
    if (!updated) return reply.code(404).send({ success: false, message: "Photo introuvable" })
    let currentId = galleryId
    const visited = new Set()
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)
      await fs.rm(path.join(process.cwd(), "tmp", `${currentId}.zip`), { force: true }).catch((error) => request.log.warn(error))
      const [parent] = await db.select({ parentGallery: galleries.parentGallery }).from(galleries).where(eq(galleries.id, currentId))
      currentId = parent?.parentGallery
    }
    return reply.send({ success: true, data: updated })
  })

  fastify.get("/galleries/:galleryId/comments", async (request, reply) => {
    const { galleryId } = request.params
    if (!uuid.test(galleryId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    if (!await canManage(request.user.id, galleryId)) return reply.code(403).send({ success: false, message: "Accès non autorisé" })
    const rows = await db.select({ id: galleryInteractions.id, photoId: galleryInteractions.photoId,
      content: galleryInteractions.content, status: galleryInteractions.status,
      guestName: galleryInteractions.guestName, firstname: users.firstname, lastname: users.lastname,
      createdAt: galleryInteractions.createdAt }).from(galleryInteractions)
      .leftJoin(users, eq(galleryInteractions.userId, users.id))
      .where(and(eq(galleryInteractions.galleryId, galleryId), eq(galleryInteractions.kind, "COMMENT")))
    return reply.send({ success: true, data: rows.filter((row) => row.status !== "PENDING").map(({ guestName, firstname, lastname, ...row }) => ({
      ...row, author: guestName || [firstname, lastname].filter(Boolean).join(" ") || "Utilisateur",
    })) })
  })

  fastify.patch("/galleries/:galleryId/comments/:commentId/visibility", async (request, reply) => {
    const { galleryId, commentId } = request.params
    if (!uuid.test(galleryId) || !uuid.test(commentId) || typeof request.body?.hidden !== "boolean") {
      return reply.code(400).send({ success: false, message: "Demande invalide" })
    }
    if (!await canManage(request.user.id, galleryId)) return reply.code(403).send({ success: false, message: "Accès non autorisé" })
    const [updated] = await db.update(galleryInteractions).set({ status: request.body.hidden ? "HIDDEN" : "PUBLISHED" })
      .where(and(eq(galleryInteractions.id, commentId), eq(galleryInteractions.galleryId, galleryId),
        eq(galleryInteractions.kind, "COMMENT"), inArray(galleryInteractions.status, ["PUBLISHED", "HIDDEN"])))
      .returning({ id: galleryInteractions.id, status: galleryInteractions.status })
    if (!updated) return reply.code(404).send({ success: false, message: "Commentaire introuvable" })
    return reply.send({ success: true, data: updated })
  })
}
