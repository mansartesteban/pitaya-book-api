import { eq } from "drizzle-orm"
import { db } from "../../database/index.js"
import { galleries } from "../../database/schema.js"

export const coverFramingFields = {
  coverPositionX: galleries.coverPositionX,
  coverPositionY: galleries.coverPositionY,
  coverZoom: galleries.coverZoom,
  coverContain: galleries.coverContain,
}

export async function saveCoverFraming(request, reply) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.galleryId)) {
    return reply.code(400).send({ success: false, message: "Identifiant invalide" })
  }
  const { coverPositionX, coverPositionY, coverZoom, coverContain } = request.body || {}
  if (![coverPositionX, coverPositionY, coverZoom].every(Number.isInteger) ||
    coverPositionX < 0 || coverPositionX > 100 || coverPositionY < 0 || coverPositionY > 100 ||
    coverZoom < 100 || coverZoom > 200 || typeof coverContain !== "boolean") {
    return reply.code(400).send({ success: false, message: "Cadrage invalide" })
  }
  const [updated] = await db.update(galleries).set({ coverPositionX, coverPositionY, coverZoom, coverContain })
    .where(eq(galleries.id, request.params.galleryId)).returning(coverFramingFields)
  if (!updated) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
  return reply.send({ success: true, data: updated })
}
