import { and, eq } from "drizzle-orm"
import { db } from "../../database/index.js"
import { favoriteGalleries, favoritePhotos, galleries, photoSelectionItems, photoSelections, photos, users } from "../../database/schema.js"
import { authenticationMiddleware } from "../../lib/middlewares/authentication.js"
import { signPhotoUrl } from "../../lib/utils/Photo.js"
import { applyGalleryExpirations } from "../gallery/galleryExpiration.js"
import { visibleTarget } from "../public/interactions/interaction.routes.js"
import { canDownloadPhoto } from "../public/gallery/downloadAccess.js"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function verified(request, reply) {
  const [account] = await db.select({ active: users.isActive, confirmed: users.emailConfirmed })
    .from(users).where(eq(users.id, request.user.id))
  if (!account?.active || !account.confirmed) return reply.code(403).send({ success: false, message: "Confirmez votre adresse e-mail" })
}

async function accessiblePhoto(request, photoId) {
  const [photo] = await db.select({ id: photos.id, galleryId: photos.galleryId, extension: photos.extension,
    galleryTitle: galleries.title, gallerySlug: galleries.slug, visibility: galleries.visibility })
    .from(photos).innerJoin(galleries, eq(photos.galleryId, galleries.id)).where(eq(photos.id, photoId))
  if (!photo || !await visibleTarget(request, photo.galleryId, photoId)) return null
  return { ...photo, thumbnailUrl: signPhotoUrl(photo, true, 300),
    downloadAllowed: canDownloadPhoto({ visibility: photo.visibility, id: photo.galleryId }, request) }
}

export default function memberLibraryRoutes(fastify) {
  fastify.addHook("preHandler", applyGalleryExpirations)
  fastify.addHook("preHandler", authenticationMiddleware)
  fastify.addHook("preHandler", verified)

  fastify.get("/", async (request, reply) => {
    const [galleryRows, photoRows, selections] = await Promise.all([
      db.select({ id: favoriteGalleries.galleryId, title: galleries.title, slug: galleries.slug })
        .from(favoriteGalleries).innerJoin(galleries, eq(favoriteGalleries.galleryId, galleries.id))
        .where(eq(favoriteGalleries.userId, request.user.id)),
      db.select({ id: favoritePhotos.photoId }).from(favoritePhotos).where(eq(favoritePhotos.userId, request.user.id)),
      db.select({ id: photoSelections.id, name: photoSelections.name, createdAt: photoSelections.createdAt })
        .from(photoSelections).where(eq(photoSelections.userId, request.user.id)),
    ])
    const visibleGalleries = []
    for (const gallery of galleryRows) if (await visibleTarget(request, gallery.id, null)) visibleGalleries.push(gallery)
    const visiblePhotos = []
    for (const photo of photoRows) {
      const accessible = await accessiblePhoto(request, photo.id)
      if (accessible) visiblePhotos.push(accessible)
    }
    return reply.send({ success: true, data: { galleries: visibleGalleries, photos: visiblePhotos, selections } })
  })

  fastify.put("/galleries/:galleryId", async (request, reply) => {
    const { galleryId } = request.params
    if (!uuid.test(galleryId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    if (!await visibleTarget(request, galleryId, null)) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
    await db.insert(favoriteGalleries).values({ userId: request.user.id, galleryId }).onConflictDoNothing()
    return reply.send({ success: true })
  })
  fastify.delete("/galleries/:galleryId", async (request, reply) => {
    if (!uuid.test(request.params.galleryId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    await db.delete(favoriteGalleries).where(and(eq(favoriteGalleries.userId, request.user.id), eq(favoriteGalleries.galleryId, request.params.galleryId)))
    return reply.send({ success: true })
  })
  fastify.put("/photos/:photoId", async (request, reply) => {
    const { photoId } = request.params
    if (!uuid.test(photoId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    if (!await accessiblePhoto(request, photoId)) return reply.code(404).send({ success: false, message: "Photo introuvable" })
    await db.insert(favoritePhotos).values({ userId: request.user.id, photoId }).onConflictDoNothing()
    return reply.send({ success: true })
  })
  fastify.delete("/photos/:photoId", async (request, reply) => {
    if (!uuid.test(request.params.photoId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    await db.delete(favoritePhotos).where(and(eq(favoritePhotos.userId, request.user.id), eq(favoritePhotos.photoId, request.params.photoId)))
    return reply.send({ success: true })
  })

  fastify.post("/selections", async (request, reply) => {
    const name = String(request.body?.name || "").trim()
    if (name.length < 1 || name.length > 80) return reply.code(400).send({ success: false, message: "Nom invalide" })
    const [created] = await db.insert(photoSelections).values({ userId: request.user.id, name })
      .returning({ id: photoSelections.id, name: photoSelections.name })
    return reply.code(201).send({ success: true, data: created })
  })
  fastify.get("/selections/:selectionId", async (request, reply) => {
    const { selectionId } = request.params
    if (!uuid.test(selectionId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    const [selection] = await db.select({ id: photoSelections.id, name: photoSelections.name })
      .from(photoSelections).where(and(eq(photoSelections.id, selectionId), eq(photoSelections.userId, request.user.id)))
    if (!selection) return reply.code(404).send({ success: false, message: "Sélection introuvable" })
    const items = await db.select({ photoId: photoSelectionItems.photoId }).from(photoSelectionItems)
      .where(eq(photoSelectionItems.selectionId, selectionId))
    const accessible = []
    for (const item of items) {
      const photo = await accessiblePhoto(request, item.photoId)
      if (photo) accessible.push(photo)
    }
    return reply.send({ success: true, data: { ...selection, photos: accessible } })
  })
  fastify.patch("/selections/:selectionId", async (request, reply) => {
    const { selectionId } = request.params
    const name = String(request.body?.name || "").trim()
    if (!uuid.test(selectionId) || name.length < 1 || name.length > 80) return reply.code(400).send({ success: false, message: "Demande invalide" })
    const [updated] = await db.update(photoSelections).set({ name })
      .where(and(eq(photoSelections.id, selectionId), eq(photoSelections.userId, request.user.id)))
      .returning({ id: photoSelections.id, name: photoSelections.name })
    if (!updated) return reply.code(404).send({ success: false, message: "Sélection introuvable" })
    return reply.send({ success: true, data: updated })
  })
  fastify.delete("/selections/:selectionId", async (request, reply) => {
    const { selectionId } = request.params
    if (!uuid.test(selectionId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    await db.delete(photoSelections).where(and(eq(photoSelections.id, selectionId), eq(photoSelections.userId, request.user.id)))
    return reply.send({ success: true })
  })
  fastify.put("/selections/:selectionId/photos/:photoId", async (request, reply) => {
    const { selectionId, photoId } = request.params
    if (!uuid.test(selectionId) || !uuid.test(photoId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    const [selection] = await db.select({ id: photoSelections.id }).from(photoSelections)
      .where(and(eq(photoSelections.id, selectionId), eq(photoSelections.userId, request.user.id)))
    if (!selection || !await accessiblePhoto(request, photoId)) return reply.code(404).send({ success: false, message: "Sélection ou photo introuvable" })
    await db.insert(photoSelectionItems).values({ selectionId, photoId }).onConflictDoNothing()
    return reply.send({ success: true })
  })
  fastify.delete("/selections/:selectionId/photos/:photoId", async (request, reply) => {
    const { selectionId, photoId } = request.params
    if (!uuid.test(selectionId) || !uuid.test(photoId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    const [selection] = await db.select({ id: photoSelections.id }).from(photoSelections)
      .where(and(eq(photoSelections.id, selectionId), eq(photoSelections.userId, request.user.id)))
    if (!selection) return reply.code(404).send({ success: false, message: "Sélection introuvable" })
    await db.delete(photoSelectionItems).where(and(eq(photoSelectionItems.selectionId, selectionId), eq(photoSelectionItems.photoId, photoId)))
    return reply.send({ success: true })
  })
}
