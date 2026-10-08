import { and, eq, ilike, or } from "drizzle-orm"
import { db } from "../../database/index.js"
import { companies, companyContacts, galleries, galleryManagerGrants, galleryManagerInvitations, galleryUserManagerGrants, users } from "../../database/schema.js"
import { sendGalleryManagementInvitation } from "../auth/auth.service.js"

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
  const direct = await db.select({ id: galleries.id, title: galleries.title, slug: galleries.slug,
    visibility: galleries.visibility, expiresAt: galleries.expiresAt })
    .from(galleryUserManagerGrants).innerJoin(galleries, eq(galleryUserManagerGrants.galleryId, galleries.id))
    .where(eq(galleryUserManagerGrants.userId, request.user.id))
  const invited = await db.select({ id: galleries.id, title: galleries.title, slug: galleries.slug,
    visibility: galleries.visibility, expiresAt: galleries.expiresAt })
    .from(galleryManagerInvitations).innerJoin(galleries, eq(galleryManagerInvitations.galleryId, galleries.id))
    .where(ilike(galleryManagerInvitations.email, account.email))
  return reply.send({ success: true, data: [...new Map([...rows, ...direct, ...invited].map((item) => [item.id, item])).values()] })
}

async function ownedGallery(request, galleryId) {
  if (!uuid.test(galleryId)) return null
  const [gallery] = await db.select({ id: galleries.id, title: galleries.title }).from(galleries)
    .where(and(eq(galleries.id, galleryId), eq(galleries.ownerUserId, request.user.id)))
  return gallery
}

export const searchGalleryManagerCandidates = async (request, reply) => {
  const gallery = await ownedGallery(request, request.params.galleryId)
  if (!gallery) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
  const query = String(request.query?.q || "").trim()
  if (query.length < 2) return reply.send({ success: true, data: [] })
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`
  const [accounts, contacts] = await Promise.all([
    db.select({ id: users.id, firstname: users.firstname, lastname: users.lastname, email: users.email,
      emailConfirmed: users.emailConfirmed, companyName: companies.name }).from(users)
      .leftJoin(companies, eq(companies.userId, users.id))
      .where(or(ilike(users.firstname, pattern), ilike(users.lastname, pattern), ilike(users.email, pattern), ilike(companies.name, pattern))).limit(20),
    db.select({ id: companyContacts.id, firstname: companyContacts.firstname, lastname: companyContacts.lastname,
      email: companyContacts.email, companyName: companies.name }).from(companyContacts)
      .innerJoin(companies, eq(companyContacts.companyId, companies.id))
      .where(or(ilike(companyContacts.firstname, pattern), ilike(companyContacts.lastname, pattern),
        ilike(companyContacts.email, pattern), ilike(companies.name, pattern))).limit(20),
  ])
  return reply.send({ success: true, data: [
    ...[...new Map(accounts.map((item) => [item.id, item])).values()].map((item) => ({ ...item, type: "USER" })),
    ...contacts.filter((item) => item.email).map((item) => ({ ...item, type: "CONTACT" })),
  ] })
}

export const listUnifiedGalleryManagers = async (request, reply) => {
  const gallery = await ownedGallery(request, request.params.galleryId)
  if (!gallery) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
  const [direct, legacy, invitations] = await Promise.all([
    db.select({ id: galleryUserManagerGrants.id, firstname: users.firstname, lastname: users.lastname,
      email: users.email, emailConfirmed: users.emailConfirmed, userId: users.id })
      .from(galleryUserManagerGrants).innerJoin(users, eq(galleryUserManagerGrants.userId, users.id))
      .where(eq(galleryUserManagerGrants.galleryId, gallery.id)),
    db.select({ id: galleryManagerGrants.id, firstname: companyContacts.firstname, lastname: companyContacts.lastname,
      email: companyContacts.email, companyName: companies.name, contactId: companyContacts.id,
      companyId: companyContacts.companyId, galleryCompanyId: galleries.clientCompanyId })
      .from(galleryManagerGrants).innerJoin(companyContacts, eq(galleryManagerGrants.contactId, companyContacts.id))
      .innerJoin(companies, eq(companyContacts.companyId, companies.id))
      .innerJoin(galleries, eq(galleryManagerGrants.galleryId, galleries.id))
      .where(eq(galleryManagerGrants.galleryId, gallery.id)),
    db.select().from(galleryManagerInvitations).where(eq(galleryManagerInvitations.galleryId, gallery.id)),
  ])
  const contacts = await db.select({ email: companyContacts.email, companyName: companies.name })
    .from(companyContacts).innerJoin(companies, eq(companyContacts.companyId, companies.id))
  const companyAccounts = await db.select({ email: users.email, companyName: companies.name })
    .from(companies).innerJoin(users, eq(companies.userId, users.id))
  const companyByEmail = new Map([...companyAccounts, ...contacts].filter((item) => item.email).map((item) => [item.email.toLowerCase(), item.companyName]))
  const accounts = await db.select({ email: users.email, emailConfirmed: users.emailConfirmed })
    .from(users)
  const accountByEmail = new Map(accounts.map((item) => [item.email.toLowerCase(), item]))
  return reply.send({ success: true, data: [
    ...direct.map((item) => ({ ...item, type: "USER", grantType: "USER", companyName: companyByEmail.get(item.email.toLowerCase()) || null,
      status: item.emailConfirmed ? "Actif" : "E-mail non vérifié" })),
    ...legacy.map((item) => ({ ...item, type: "CONTACT", grantType: "CONTACT",
      status: item.companyId !== item.galleryCompanyId ? "Accès à réattribuer" : accountByEmail.get(item.email?.toLowerCase())?.emailConfirmed ? "Actif" : "Inscription attendue" })),
    ...invitations.map((item) => ({ ...item, type: item.contactId ? "CONTACT" : "EXTERNAL", grantType: "INVITATION",
      companyName: companyByEmail.get(item.email.toLowerCase()) || null,
      status: accountByEmail.get(item.email.toLowerCase())?.emailConfirmed ? "Actif" : item.sentAt ? "Invitation envoyée" : "Invitation en attente" })),
  ] })
}

export const addUnifiedGalleryManager = async (request, reply) => {
  const gallery = await ownedGallery(request, request.params.galleryId)
  if (!gallery) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
  const { type, id } = request.body || {}
  let candidate
  if (type === "USER" && uuid.test(id || "")) {
    const [account] = await db.select({ id: users.id, firstname: users.firstname, lastname: users.lastname,
      email: users.email, emailConfirmed: users.emailConfirmed }).from(users).where(eq(users.id, id))
    candidate = account
    if (candidate) {
      await db.insert(galleryUserManagerGrants).values({ galleryId: gallery.id, userId: candidate.id,
        grantedByUserId: request.user.id }).onConflictDoNothing()
      return reply.send({ success: true })
    }
  } else if (type === "CONTACT" && uuid.test(id || "")) {
    const [contact] = await db.select({ id: companyContacts.id, firstname: companyContacts.firstname,
      lastname: companyContacts.lastname, email: companyContacts.email })
      .from(companyContacts).where(eq(companyContacts.id, id))
    candidate = contact ? { ...contact, contactId: contact.id } : null
  } else if (type === "EXTERNAL") {
    const email = String(request.body?.email || "").trim().toLowerCase()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) candidate = { email, firstname: null, lastname: null, contactId: null }
  }
  if (!candidate?.email) return reply.code(400).send({ success: false, message: "Utilisateur introuvable ou adresse e-mail invalide" })
  const email = candidate.email.toLowerCase()
  const [existingAccount] = await db.select({ id: users.id }).from(users).where(ilike(users.email, email))
  if (existingAccount) {
    await db.insert(galleryUserManagerGrants).values({ galleryId: gallery.id, userId: existingAccount.id,
      grantedByUserId: request.user.id }).onConflictDoNothing()
    return reply.send({ success: true })
  }
  const [invitation] = await db.insert(galleryManagerInvitations).values({ galleryId: gallery.id, email,
    firstname: candidate.firstname, lastname: candidate.lastname, contactId: candidate.contactId,
    invitedByUserId: request.user.id }).onConflictDoNothing().returning()
  if (!invitation) return reply.send({ success: true, message: "Invitation déjà enregistrée" })
  try {
    const base = (process.env.FRONTEND_URL || "https://pitaya-photo.com").replace(/\/$/, "")
    await sendGalleryManagementInvitation({ email, firstname: candidate.firstname,
      galleryTitle: gallery.title, signUpUrl: `${base}/authentication/sign-up` })
    await db.update(galleryManagerInvitations).set({ sentAt: new Date() }).where(eq(galleryManagerInvitations.id, invitation.id))
  } catch (error) {
    request.log.error(error, "Envoi de l'invitation impossible")
    return reply.code(502).send({ success: false, message: "Accès enregistré, mais le courriel d'invitation n'a pas pu être envoyé" })
  }
  return reply.send({ success: true, message: "Invitation envoyée" })
}

export const removeUnifiedGalleryManager = async (request, reply) => {
  const gallery = await ownedGallery(request, request.params.galleryId)
  if (!gallery) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
  const { type, id } = request.params
  if (!uuid.test(id)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
  const table = type === "USER" ? galleryUserManagerGrants : type === "CONTACT" ? galleryManagerGrants : type === "INVITATION" ? galleryManagerInvitations : null
  if (!table) return reply.code(400).send({ success: false, message: "Type invalide" })
  await db.delete(table).where(and(eq(table.id, id), eq(table.galleryId, gallery.id)))
  return reply.send({ success: true })
}

export const resendGalleryManagerInvitation = async (request, reply) => {
  const gallery = await ownedGallery(request, request.params.galleryId)
  if (!gallery) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
  if (!uuid.test(request.params.id)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
  const [invitation] = await db.select().from(galleryManagerInvitations)
    .where(and(eq(galleryManagerInvitations.id, request.params.id), eq(galleryManagerInvitations.galleryId, gallery.id)))
  if (!invitation) return reply.code(404).send({ success: false, message: "Invitation introuvable" })
  try {
    const base = (process.env.FRONTEND_URL || "https://pitaya-photo.com").replace(/\/$/, "")
    await sendGalleryManagementInvitation({ email: invitation.email, firstname: invitation.firstname,
      galleryTitle: gallery.title, signUpUrl: `${base}/authentication/sign-up` })
    await db.update(galleryManagerInvitations).set({ sentAt: new Date() }).where(eq(galleryManagerInvitations.id, invitation.id))
    return reply.send({ success: true })
  } catch (error) {
    request.log.error(error, "Nouvel envoi de l'invitation impossible")
    return reply.code(502).send({ success: false, message: "Le courriel n'a pas pu être envoyé" })
  }
}

export const listGalleryUserManagers = async (request, reply) => {
  const { galleryId } = request.params
  if (!uuid.test(galleryId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
  const [gallery] = await db.select({ id: galleries.id }).from(galleries)
    .where(and(eq(galleries.id, galleryId), eq(galleries.ownerUserId, request.user.id)))
  if (!gallery) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
  const rows = await db.select({ id: users.id, firstname: users.firstname, lastname: users.lastname, email: users.email })
    .from(galleryUserManagerGrants).innerJoin(users, eq(galleryUserManagerGrants.userId, users.id))
    .where(eq(galleryUserManagerGrants.galleryId, galleryId))
  return reply.send({ success: true, data: rows })
}

export const addGalleryUserManager = async (request, reply) => {
  const { galleryId } = request.params
  const email = String(request.body?.email || "").trim().toLowerCase()
  if (!uuid.test(galleryId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).send({ success: false, message: "Adresse e-mail invalide" })
  const [gallery] = await db.select({ id: galleries.id }).from(galleries)
    .where(and(eq(galleries.id, galleryId), eq(galleries.ownerUserId, request.user.id)))
  if (!gallery) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
  const [account] = await db.select({ id: users.id, emailConfirmed: users.emailConfirmed, isActive: users.isActive })
    .from(users).where(ilike(users.email, email))
  if (!account?.isActive || !account.emailConfirmed) return reply.code(400).send({ success: false, message: "Ce compte doit exister et avoir une adresse e-mail confirmée" })
  await db.insert(galleryUserManagerGrants).values({ galleryId, userId: account.id, grantedByUserId: request.user.id }).onConflictDoNothing()
  return reply.send({ success: true })
}

export const removeGalleryUserManager = async (request, reply) => {
  const { galleryId, userId } = request.params
  if (!uuid.test(galleryId) || !uuid.test(userId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
  const [gallery] = await db.select({ id: galleries.id }).from(galleries)
    .where(and(eq(galleries.id, galleryId), eq(galleries.ownerUserId, request.user.id)))
  if (!gallery) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
  await db.delete(galleryUserManagerGrants).where(and(eq(galleryUserManagerGrants.galleryId, galleryId), eq(galleryUserManagerGrants.userId, userId)))
  return reply.send({ success: true })
}
