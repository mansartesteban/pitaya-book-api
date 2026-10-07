import { and, eq, ilike } from "drizzle-orm"
import { db } from "../../database/index.js"
import { companyContacts, galleries, galleryManagerGrants, users } from "../../database/schema.js"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const listGalleryManagers = async (request, reply) => {
  const { galleryId } = request.params
  if (!uuid.test(galleryId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
  const [gallery] = await db.select({ id: galleries.id, clientCompanyId: galleries.clientCompanyId })
    .from(galleries).where(and(eq(galleries.id, galleryId), eq(galleries.ownerUserId, request.user.id)))
  if (!gallery) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
  const grants = await db.select({
    contactId: companyContacts.id,
    firstname: companyContacts.firstname,
    lastname: companyContacts.lastname,
    email: companyContacts.email,
  }).from(galleryManagerGrants)
    .innerJoin(companyContacts, eq(galleryManagerGrants.contactId, companyContacts.id))
    .where(eq(galleryManagerGrants.galleryId, galleryId))
  return reply.send({ success: true, data: grants })
}

export const replaceGalleryManagers = async (request, reply) => {
  const { galleryId } = request.params
  const contactIds = request.body?.contactIds
  if (!uuid.test(galleryId) || !Array.isArray(contactIds) || contactIds.some((id) => !uuid.test(id)) || new Set(contactIds).size !== contactIds.length) {
    return reply.code(400).send({ success: false, message: "Destinataires invalides" })
  }
  const [gallery] = await db.select({ clientCompanyId: galleries.clientCompanyId })
    .from(galleries).where(and(eq(galleries.id, galleryId), eq(galleries.ownerUserId, request.user.id)))
  if (!gallery) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
  if (!gallery.clientCompanyId && contactIds.length) return reply.code(400).send({ success: false, message: "Associez d'abord un client à cette galerie" })
  if (contactIds.length) {
    const contacts = await db.select({ id: companyContacts.id, email: companyContacts.email })
      .from(companyContacts).where(eq(companyContacts.companyId, gallery.clientCompanyId))
    const allowed = new Map(contacts.map((contact) => [contact.id, contact]))
    if (contactIds.some((id) => !allowed.get(id)?.email)) {
      return reply.code(400).send({ success: false, message: "Chaque gestionnaire doit être un contact du client avec une adresse e-mail" })
    }
  }
  await db.transaction(async (tx) => {
    await tx.delete(galleryManagerGrants).where(eq(galleryManagerGrants.galleryId, galleryId))
    if (contactIds.length) await tx.insert(galleryManagerGrants).values(contactIds.map((contactId) => ({
      galleryId, contactId, grantedByUserId: request.user.id,
    })))
  })
  return reply.send({ success: true })
}

export const listMyManagedGalleries = async (request, reply) => {
  const [account] = await db.select({ email: users.email, emailConfirmed: users.emailConfirmed, isActive: users.isActive })
    .from(users).where(eq(users.id, request.user.id))
  if (!account?.isActive || !account.emailConfirmed) return reply.code(403).send({ success: false, message: "Confirmez votre adresse e-mail" })
  const rows = await db.select({
    id: galleries.id,
    title: galleries.title,
    slug: galleries.slug,
    visibility: galleries.visibility,
    expiresAt: galleries.expiresAt,
    contactId: companyContacts.id,
  }).from(galleryManagerGrants)
    .innerJoin(galleries, eq(galleryManagerGrants.galleryId, galleries.id))
    .innerJoin(companyContacts, eq(galleryManagerGrants.contactId, companyContacts.id))
    .where(and(ilike(companyContacts.email, account.email), eq(companyContacts.companyId, galleries.clientCompanyId)))
  return reply.send({ success: true, data: rows })
}
