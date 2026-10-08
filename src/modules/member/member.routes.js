import { and, eq, gte, ilike, inArray, sql } from "drizzle-orm"
import { db } from "../../database/index.js"
import { companyContacts, galleries, galleryInteractions, galleryManagerGrants, galleryManagerInvitations, galleryUserManagerGrants, galleryViewEvents, photos, users } from "../../database/schema.js"
import { authenticationMiddleware } from "../../lib/middlewares/authentication.js"
import { signPhotoUrl } from "../../lib/utils/Photo.js"
import fs from "node:fs/promises"
import path from "node:path"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function canManageAtLevel(userId, galleryId, account) {
  const [owned] = await db.select({ id: galleries.id }).from(galleries)
    .where(and(eq(galleries.id, galleryId), eq(galleries.ownerUserId, userId)))
  if (owned) return true
  const [direct] = await db.select({ id: galleryUserManagerGrants.id }).from(galleryUserManagerGrants)
    .where(and(eq(galleryUserManagerGrants.galleryId, galleryId), eq(galleryUserManagerGrants.userId, userId)))
  if (direct) return true
  const [invitation] = await db.select({ id: galleryManagerInvitations.id }).from(galleryManagerInvitations)
    .where(and(eq(galleryManagerInvitations.galleryId, galleryId), ilike(galleryManagerInvitations.email, account.email)))
  if (invitation) return true
  const [grant] = await db.select({ id: galleryManagerGrants.id }).from(galleryManagerGrants)
    .innerJoin(galleries, eq(galleryManagerGrants.galleryId, galleries.id))
    .innerJoin(companyContacts, eq(galleryManagerGrants.contactId, companyContacts.id))
    .where(and(eq(galleries.id, galleryId), eq(galleries.clientCompanyId, companyContacts.companyId), ilike(companyContacts.email, account.email)))
  return !!grant
}

export async function canManage(userId, galleryId) {
  const [account] = await db.select({ email: users.email, emailConfirmed: users.emailConfirmed, isActive: users.isActive })
    .from(users).where(eq(users.id, userId))
  if (!account?.isActive || !account.emailConfirmed) return false
  const visited = new Set()
  let currentId = galleryId
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    if (await canManageAtLevel(userId, currentId, account)) return true
    const [current] = await db.select({ parentGallery: galleries.parentGallery }).from(galleries).where(eq(galleries.id, currentId))
    currentId = current?.parentGallery
  }
  return false
}

async function galleryBranch(rootId) {
  const [root] = await db.select({ id: galleries.id, title: galleries.title, slug: galleries.slug,
    parentGallery: galleries.parentGallery }).from(galleries).where(eq(galleries.id, rootId))
  if (!root) return []
  const branch = [root]
  const seen = new Set([root.id])
  let frontier = [root.id]
  while (frontier.length) {
    const children = await db.select({ id: galleries.id, title: galleries.title, slug: galleries.slug,
      parentGallery: galleries.parentGallery }).from(galleries).where(inArray(galleries.parentGallery, frontier))
    const fresh = children.filter((item) => !seen.has(item.id))
    for (const child of fresh) seen.add(child.id)
    branch.push(...fresh)
    frontier = fresh.map((item) => item.id)
  }
  return branch
}

export default function memberRoutes(fastify) {
  fastify.addHook("preHandler", authenticationMiddleware)

  fastify.get("/galleries/:galleryId/tree", async (request, reply) => {
    const { galleryId } = request.params
    if (!uuid.test(galleryId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    if (!await canManage(request.user.id, galleryId)) return reply.code(403).send({ success: false, message: "Accès non autorisé" })
    const branch = await galleryBranch(galleryId)
    if (!branch.length) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
    const ids = branch.map((item) => item.id)
    const [photoRows, commentRows] = await Promise.all([
      db.select({ id: photos.id, extension: photos.extension, isHidden: photos.isHidden, galleryId: photos.galleryId })
        .from(photos).where(inArray(photos.galleryId, ids)),
      db.select({ id: galleryInteractions.id, galleryId: galleryInteractions.galleryId,
        photoId: galleryInteractions.photoId, content: galleryInteractions.content,
        status: galleryInteractions.status, guestName: galleryInteractions.guestName,
        firstname: users.firstname, lastname: users.lastname, createdAt: galleryInteractions.createdAt })
        .from(galleryInteractions).leftJoin(users, eq(galleryInteractions.userId, users.id))
        .where(and(inArray(galleryInteractions.galleryId, ids), eq(galleryInteractions.kind, "COMMENT"),
          inArray(galleryInteractions.status, ["PUBLISHED", "HIDDEN"]))),
    ])
    const nodes = new Map(branch.map((item) => [item.id, { ...item, photos: [], comments: [], children: [] }]))
    for (const photo of photoRows) nodes.get(photo.galleryId).photos.push({ ...photo,
      thumbnailUrl: signPhotoUrl(photo, true, 300), comments: [] })
    const photosById = new Map([...nodes.values()].flatMap((node) => node.photos.map((photo) => [photo.id, photo])))
    for (const { guestName, firstname, lastname, ...comment } of commentRows) {
      const value = { ...comment, author: guestName || [firstname, lastname].filter(Boolean).join(" ") || "Utilisateur" }
      const photo = comment.photoId ? photosById.get(comment.photoId) : null
      if (photo && photo.galleryId === comment.galleryId) photo.comments.push(value)
      else nodes.get(comment.galleryId).comments.push(value)
    }
    for (const node of nodes.values()) if (node.id !== galleryId && nodes.has(node.parentGallery)) nodes.get(node.parentGallery).children.push(node)
    return reply.send({ success: true, data: nodes.get(galleryId) })
  })

  fastify.get("/galleries/:galleryId/stats", async (request, reply) => {
    const { galleryId } = request.params
    if (!uuid.test(galleryId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    if (!await canManage(request.user.id, galleryId)) return reply.code(403).send({ success: false, message: "Accès non autorisé" })
    const branchIds = (await galleryBranch(galleryId)).map((item) => item.id)
    const [views] = await db.select({
      galleryViews: sql`count(*) filter (where ${galleryViewEvents.photoId} is null)`,
      photoViews: sql`count(*) filter (where ${galleryViewEvents.photoId} is not null)`,
      registeredVisitors: sql`count(distinct ${galleryViewEvents.userId})`,
      guestVisitors: sql`count(distinct ${galleryViewEvents.visitorHash}) filter (where ${galleryViewEvents.userId} is null)`,
    }).from(galleryViewEvents).where(and(inArray(galleryViewEvents.galleryId, branchIds),
      gte(galleryViewEvents.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))))
    const [interactions] = await db.select({
      reactions: sql`count(*) filter (where ${galleryInteractions.kind} = 'REACTION' and ${galleryInteractions.status} = 'PUBLISHED')`,
      comments: sql`count(*) filter (where ${galleryInteractions.kind} = 'COMMENT' and ${galleryInteractions.status} = 'PUBLISHED')`,
    }).from(galleryInteractions).where(inArray(galleryInteractions.galleryId, branchIds))
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
