import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm"
import { db } from "../../database/index.js"
import { companies, companyContacts, galleries, galleryReminders, galleryReminderRecipients, galleryReminderDeliveries } from "../../database/schema.js"
import { checkGalleryRemindersNow } from "./galleryReminderScheduler.js"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const maxValues = { MINUTE: 525600, DAY: 365, WEEK: 52, MONTH: 12 }

async function ownedRootGallery(request, reply) {
  const { galleryId } = request.params
  if (!uuid.test(galleryId)) {
    reply.code(400).send({ success: false, message: "Identifiant invalide" })
    return null
  }
  const [gallery] = await db.select({
    id: galleries.id, parentGallery: galleries.parentGallery, companyId: galleries.clientCompanyId,
  }).from(galleries).where(and(eq(galleries.id, galleryId), eq(galleries.ownerUserId, request.user.id)))
  if (!gallery) reply.code(404).send({ success: false, message: "Galerie introuvable" })
  else if (gallery.parentGallery) reply.code(400).send({ success: false, message: "Les rappels sont définis sur la galerie parente" })
  return gallery?.parentGallery ? null : gallery
}

async function validateReminder(request, reply, gallery) {
  const { value, unit, contactIds = [] } = request.body ?? {}
  if (!Object.hasOwn(maxValues, unit) || !Number.isInteger(value) || value < 1 || value > maxValues[unit] ||
      !Array.isArray(contactIds) || contactIds.length > 100 || contactIds.some((id) => !uuid.test(id))) {
    reply.code(400).send({ success: false, message: "Rappel invalide" })
    return null
  }
  const uniqueIds = [...new Set(contactIds)]
  if (uniqueIds.length && !gallery.companyId) {
    reply.code(400).send({ success: false, message: "Associez d’abord un client à la galerie" })
    return null
  }
  if (gallery.companyId) {
    const [company] = await db.select({ id: companies.id }).from(companies).where(and(
      eq(companies.id, gallery.companyId), or(eq(companies.userId, request.user.id), isNull(companies.userId))
    ))
    if (!company) {
      reply.code(404).send({ success: false, message: "Société introuvable" })
      return null
    }
    const contacts = uniqueIds.length ? await db.select({ id: companyContacts.id }).from(companyContacts)
      .where(and(eq(companyContacts.companyId, gallery.companyId), inArray(companyContacts.id, uniqueIds))) : []
    if (contacts.length !== uniqueIds.length) {
      reply.code(400).send({ success: false, message: "Un contact n’appartient pas à ce client" })
      return null
    }
  }
  return { value, unit, contactIds: uniqueIds }
}

export async function listGalleryReminders(request, reply) {
  const gallery = await ownedRootGallery(request, reply)
  if (!gallery) return
  const reminders = await db.select({
    id: galleryReminders.id, value: galleryReminders.value,
    unit: galleryReminders.unit, createdAt: galleryReminders.createdAt,
  }).from(galleryReminders).where(eq(galleryReminders.galleryId, gallery.id))
    .orderBy(asc(galleryReminders.createdAt), asc(galleryReminders.id))
  const recipients = reminders.length ? await db.select({
    reminderId: galleryReminderRecipients.reminderId, contactId: galleryReminderRecipients.contactId,
  }).from(galleryReminderRecipients)
    .where(inArray(galleryReminderRecipients.reminderId, reminders.map((item) => item.id))) : []
  return reply.send({ success: true, data: reminders.map((item) => ({
    ...item,
    contactIds: recipients.filter((recipient) => recipient.reminderId === item.id).map((recipient) => recipient.contactId),
  })) })
}

export async function createGalleryReminder(request, reply) {
  const gallery = await ownedRootGallery(request, reply)
  if (!gallery) return
  const data = await validateReminder(request, reply, gallery)
  if (!data) return
  const [reminder] = await db.transaction(async (tx) => {
    const created = await tx.insert(galleryReminders).values({
      galleryId: gallery.id, value: data.value, unit: data.unit,
    }).returning({ id: galleryReminders.id })
    if (data.contactIds.length) await tx.insert(galleryReminderRecipients).values(
      data.contactIds.map((contactId) => ({ reminderId: created[0].id, contactId }))
    )
    return created
  })
  checkGalleryRemindersNow(request.log)
  return reply.code(201).send({ success: true, data: reminder })
}

export async function updateGalleryReminder(request, reply) {
  const gallery = await ownedRootGallery(request, reply)
  if (!gallery) return
  const { reminderId } = request.params
  if (!uuid.test(reminderId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
  const [existing] = await db.select({ id: galleryReminders.id }).from(galleryReminders)
    .where(and(eq(galleryReminders.id, reminderId), eq(galleryReminders.galleryId, gallery.id)))
  if (!existing) return reply.code(404).send({ success: false, message: "Rappel introuvable" })
  const data = await validateReminder(request, reply, gallery)
  if (!data) return
  await db.transaction(async (tx) => {
    await tx.update(galleryReminders).set({ value: data.value, unit: data.unit })
      .where(eq(galleryReminders.id, reminderId))
    await tx.delete(galleryReminderRecipients).where(eq(galleryReminderRecipients.reminderId, reminderId))
    if (data.contactIds.length) await tx.insert(galleryReminderRecipients).values(
      data.contactIds.map((contactId) => ({ reminderId, contactId }))
    )
  })
  checkGalleryRemindersNow(request.log)
  return reply.send({ success: true })
}

export async function deleteGalleryReminder(request, reply) {
  const gallery = await ownedRootGallery(request, reply)
  if (!gallery) return
  const { reminderId } = request.params
  if (!uuid.test(reminderId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
  const [deleted] = await db.delete(galleryReminders).where(and(
    eq(galleryReminders.id, reminderId), eq(galleryReminders.galleryId, gallery.id)
  )).returning({ id: galleryReminders.id })
  if (!deleted) return reply.code(404).send({ success: false, message: "Rappel introuvable" })
  return reply.send({ success: true })
}

export async function listGalleryReminderDeliveries(request, reply) {
  const gallery = await ownedRootGallery(request, reply)
  if (!gallery) return
  const rows = await db.select({ id: galleryReminderDeliveries.id,
    eventKey: galleryReminderDeliveries.eventKey, status: galleryReminderDeliveries.status,
    attemptCount: galleryReminderDeliveries.attemptCount,
    attemptedAt: galleryReminderDeliveries.attemptedAt,
    nextAttemptAt: galleryReminderDeliveries.nextAttemptAt,
    sentAt: galleryReminderDeliveries.sentAt, lastError: galleryReminderDeliveries.lastError,
    firstname: companyContacts.firstname, lastname: companyContacts.lastname,
    email: companyContacts.email,
  }).from(galleryReminderDeliveries)
    .innerJoin(companyContacts, eq(galleryReminderDeliveries.contactId, companyContacts.id))
    .where(eq(galleryReminderDeliveries.galleryId, gallery.id))
    .orderBy(desc(galleryReminderDeliveries.attemptedAt)).limit(100)
  return reply.send({ success: true, data: rows })
}

export async function retryGalleryReminderDelivery(request, reply) {
  const gallery = await ownedRootGallery(request, reply)
  if (!gallery) return
  const { deliveryId } = request.params
  if (!uuid.test(deliveryId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
  const [current] = await db.select({
    status: galleryReminderDeliveries.status, contactId: galleryReminderDeliveries.contactId,
    expiresAt: galleries.expiresAt, companyId: galleries.clientCompanyId,
  }).from(galleryReminderDeliveries)
    .innerJoin(galleries, eq(galleryReminderDeliveries.galleryId, galleries.id))
    .where(and(eq(galleryReminderDeliveries.id, deliveryId), eq(galleryReminderDeliveries.galleryId, gallery.id)))
  if (!current) return reply.code(404).send({ success: false, message: "Envoi introuvable" })
  if (!current.expiresAt || current.expiresAt <= new Date())
    return reply.code(400).send({ success: false, message: "La galerie est expirée : aucun e-mail tardif ne sera envoyé" })
  if (!["FAILED", "UNKNOWN"].includes(current.status))
    return reply.code(400).send({ success: false, message: "Cet envoi ne peut pas être relancé" })
  const [contact] = await db.select({ id: companyContacts.id, email: companyContacts.email }).from(companyContacts)
    .where(and(eq(companyContacts.id, current.contactId), eq(companyContacts.companyId, current.companyId),
      eq(companyContacts.remindersEnabled, true)))
  if (!contact?.email) return reply.code(400).send({ success: false, message: "Le contact ne reçoit plus ces rappels" })
  const [updated] = await db.update(galleryReminderDeliveries).set({
    status: "PENDING", attemptCount: 0, nextAttemptAt: new Date(), leaseUntil: null, lastError: null,
  }).where(and(eq(galleryReminderDeliveries.id, deliveryId),
    inArray(galleryReminderDeliveries.status, ["FAILED", "UNKNOWN"]))).returning({ id: galleryReminderDeliveries.id })
  if (!updated) return reply.code(409).send({ success: false, message: "Cet envoi a changé d’état" })
  checkGalleryRemindersNow(request.log)
  return reply.send({ success: true })
}
