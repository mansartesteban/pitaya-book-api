import { and, eq, notInArray } from "drizzle-orm"
import { db } from "../../database/index.js"
import { adminNotifications, galleries, users } from "../../database/schema.js"

export async function notifyPublicGalleryPublished(galleryId) {
  const [gallery] = await db.select({ id: galleries.id, title: galleries.title, parentGallery: galleries.parentGallery,
    visibility: galleries.visibility }).from(galleries).where(eq(galleries.id, galleryId))
  if (!gallery || gallery.visibility !== "PUBLIC" || gallery.parentGallery) return
  const recipients = await db.select({ id: users.id }).from(users).where(and(
    eq(users.isActive, true), eq(users.emailConfirmed, true),
    eq(users.publicGalleryNotificationsEnabled, true), notInArray(users.role, ["ADMIN", "SUPERADMIN"])
  ))
  if (!recipients.length) return
  const eventKey = `gallery-published:${gallery.id}:${Date.now()}`
  await db.insert(adminNotifications).values(recipients.map((account) => ({
    ownerUserId: account.id, galleryId: gallery.id,
    kind: "GALLERY_PUBLISHED", title: "Nouvelle galerie publiée",
    body: gallery.title, eventKey,
  }))).onConflictDoNothing()
}
