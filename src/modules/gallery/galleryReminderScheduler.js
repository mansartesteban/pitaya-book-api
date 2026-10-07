import nodemailer from "nodemailer"
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm"
import { db } from "../../database/index.js"
import { adminNotifications, companyContacts, galleries, galleryReminders, galleryReminderRecipients, galleryReminderDeliveries } from "../../database/schema.js"
import { galleryExpirationReminderMail } from "../../mailing/galleryExpirationReminder.js"

const createTransport = () => process.env.SMTP_SERVER && process.env.SMTP_USERNAME && process.env.SMTP_PASSWORD
  ? nodemailer.createTransport({ host: process.env.SMTP_SERVER, port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD } }) : null
let running = false
const schedulerEnabled = () => process.env.GALLERY_REMINDERS_ENABLED !== "false" &&
  (process.env.NODE_ENV === "production" || process.env.GALLERY_REMINDERS_ENABLED === "true")

async function notify(ownerUserId, galleryId, eventKey, title, body, kind = "GALLERY_EXPIRY") {
  await db.insert(adminNotifications).values({ ownerUserId, galleryId, eventKey, title, body, kind }).onConflictDoNothing()
}

async function recoverInterrupted() {
  const stale = await db.update(galleryReminderDeliveries).set({ status: "UNKNOWN", leaseUntil: null,
    lastError: "Envoi interrompu : vérifier la réception avant de relancer." })
    .where(and(eq(galleryReminderDeliveries.status, "SENDING"),
      or(lte(galleryReminderDeliveries.leaseUntil, new Date()), isNull(galleryReminderDeliveries.leaseUntil))))
    .returning({ galleryId: galleryReminderDeliveries.galleryId, contactId: galleryReminderDeliveries.contactId,
      eventKey: galleryReminderDeliveries.eventKey })
  for (const row of stale) {
    const [gallery] = await db.select({ ownerUserId: galleries.ownerUserId, title: galleries.title })
      .from(galleries).where(eq(galleries.id, row.galleryId))
    if (gallery?.ownerUserId) await notify(gallery.ownerUserId, row.galleryId,
      `${row.eventKey}:uncertain:${row.contactId}`, `Envoi à vérifier pour « ${gallery.title} »`,
      "L’API s’est interrompue pendant un e-mail. Vérifie sa réception avant une éventuelle relance.",
      "GALLERY_REMINDER_UNCERTAIN")
  }
}

async function auditDueRules() {
  const due = await db.select({ id: galleries.id, title: galleries.title, expiresAt: galleries.expiresAt,
    companyId: galleries.clientCompanyId, visibility: galleries.visibility,
    reminderId: galleryReminders.id, ownerUserId: galleries.ownerUserId })
    .from(galleryReminders).innerJoin(galleries, eq(galleryReminders.galleryId, galleries.id)).where(and(
      sql`${galleries.expiresAt} IS NOT NULL`, sql`${galleries.parentGallery} IS NULL`,
      sql`${galleries.expiresAt} - (${galleryReminders.value} * CASE ${galleryReminders.unit}
        WHEN 'MINUTE' THEN interval '1 minute' WHEN 'WEEK' THEN interval '1 week'
        WHEN 'MONTH' THEN interval '1 month' ELSE interval '1 day' END) <= now()`))
  for (const gallery of due) {
    if (!gallery.ownerUserId) continue
    const eventKey = `gallery-expiry:${gallery.id}:${gallery.reminderId}:${gallery.expiresAt.getTime()}`
    if (gallery.expiresAt <= new Date()) {
      const [sent] = await db.select({ id: galleryReminderDeliveries.id }).from(galleryReminderDeliveries)
        .where(and(eq(galleryReminderDeliveries.eventKey, eventKey), eq(galleryReminderDeliveries.status, "SENT"))).limit(1)
      const [adminAlert] = await db.select({ id: adminNotifications.id }).from(adminNotifications)
        .where(and(eq(adminNotifications.ownerUserId, gallery.ownerUserId), eq(adminNotifications.eventKey, eventKey))).limit(1)
      const [unsent] = await db.select({ id: galleryReminderDeliveries.id }).from(galleryReminderDeliveries)
        .where(and(eq(galleryReminderDeliveries.eventKey, eventKey),
          inArray(galleryReminderDeliveries.status, ["PENDING", "FAILED", "UNKNOWN"]))).limit(1)
      if (unsent || (!sent && !adminAlert)) await notify(gallery.ownerUserId, gallery.id, `${eventKey}:missed`,
        `Rappel manqué pour « ${gallery.title} »`,
        "La galerie a expiré avant l’envoi du rappel. Aucun e-mail tardif n’a été envoyé au client.",
        "GALLERY_REMINDER_MISSED")
      await db.update(galleryReminderDeliveries).set({ status: "MISSED", nextAttemptAt: null, leaseUntil: null })
        .where(and(eq(galleryReminderDeliveries.galleryId, gallery.id), eq(galleryReminderDeliveries.eventKey, eventKey),
          inArray(galleryReminderDeliveries.status, ["PENDING", "FAILED"])))
      continue
    }
    if (gallery.visibility === "HIDDEN") continue
    const date = gallery.expiresAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })
    await notify(gallery.ownerUserId, gallery.id, eventKey,
      `La galerie « ${gallery.title} » expire bientôt`, `Échéance prévue le ${date}.`)
    if (!gallery.companyId) continue
    const recipients = await db.select({ id: companyContacts.id, email: companyContacts.email })
      .from(galleryReminderRecipients)
      .innerJoin(companyContacts, eq(galleryReminderRecipients.contactId, companyContacts.id))
      .where(and(eq(galleryReminderRecipients.reminderId, gallery.reminderId),
        eq(companyContacts.companyId, gallery.companyId), eq(companyContacts.remindersEnabled, true)))
    for (const contact of recipients) if (contact.email) await db.insert(galleryReminderDeliveries).values({
      galleryId: gallery.id, contactId: contact.id, eventKey, status: "PENDING", nextAttemptAt: new Date(),
    }).onConflictDoNothing()
  }
}

async function processQueue(transport, log) {
  if (!transport) return
  const publicBase = (process.env.FRONTEND_URL || "https://pitaya-photo.com").replace(/\/$/, "")
  const queued = await db.select({ id: galleryReminderDeliveries.id }).from(galleryReminderDeliveries)
    .where(and(eq(galleryReminderDeliveries.status, "PENDING"),
      or(isNull(galleryReminderDeliveries.nextAttemptAt), lte(galleryReminderDeliveries.nextAttemptAt, new Date()))))
    .limit(100)
  for (const item of queued) {
    const [claimed] = await db.update(galleryReminderDeliveries).set({ status: "SENDING",
      leaseUntil: new Date(Date.now() + 10 * 60 * 1000), attemptedAt: new Date(),
      attemptCount: sql`${galleryReminderDeliveries.attemptCount} + 1` })
      .where(and(eq(galleryReminderDeliveries.id, item.id),
        eq(galleryReminderDeliveries.status, "PENDING"),
        or(isNull(galleryReminderDeliveries.nextAttemptAt), lte(galleryReminderDeliveries.nextAttemptAt, new Date()))))
      .returning()
    if (!claimed) continue
    const [record] = await db.select({ title: galleries.title, slug: galleries.slug,
      expiresAt: galleries.expiresAt, ownerUserId: galleries.ownerUserId,
      companyId: galleries.clientCompanyId, email: companyContacts.email,
      firstname: companyContacts.firstname, token: companyContacts.reminderToken,
      remindersEnabled: companyContacts.remindersEnabled, contactCompanyId: companyContacts.companyId })
      .from(galleryReminderDeliveries)
      .innerJoin(galleries, eq(galleryReminderDeliveries.galleryId, galleries.id))
      .innerJoin(companyContacts, eq(galleryReminderDeliveries.contactId, companyContacts.id))
      .where(eq(galleryReminderDeliveries.id, claimed.id))
    const [, , reminderId, expiryStamp] = claimed.eventKey.split(":")
    const [activeRecipient] = await db.select({ id: galleryReminderRecipients.contactId })
      .from(galleryReminderRecipients)
      .innerJoin(galleryReminders, eq(galleryReminderRecipients.reminderId, galleryReminders.id))
      .where(and(eq(galleryReminderRecipients.reminderId, reminderId),
        eq(galleryReminderRecipients.contactId, claimed.contactId),
        eq(galleryReminders.galleryId, claimed.galleryId)))
    if (!record || !record.expiresAt || record.expiresAt <= new Date() ||
      !record.remindersEnabled || !record.email || record.companyId !== record.contactCompanyId ||
      !activeRecipient || String(record.expiresAt.getTime()) !== expiryStamp) {
      await db.update(galleryReminderDeliveries).set({ status: "MISSED", leaseUntil: null, nextAttemptAt: null })
        .where(eq(galleryReminderDeliveries.id, claimed.id))
      continue
    }
    const mail = galleryExpirationReminderMail({ firstname: record.firstname,
      galleryTitle: record.title, expiresAt: record.expiresAt,
      galleryUrl: `${publicBase}/galleries/${encodeURIComponent(record.slug)}`,
      preferencesUrl: `${publicBase}/preferences-rappels/${record.token}`,
      contactEmail: process.env.GALLERY_CONTACT_EMAIL || "esteban@pitaya-photo.com" })
    try {
      await transport.sendMail({ from: `Pitaya Photo <${process.env.SMTP_FROM || "noreply@pitaya-photo.com"}>`,
        to: record.email, ...mail })
      await db.update(galleryReminderDeliveries).set({ status: "SENT", sentAt: new Date(),
        leaseUntil: null, nextAttemptAt: null, lastError: null })
        .where(eq(galleryReminderDeliveries.id, claimed.id))
    } catch (error) {
      log.error(error)
      await db.update(galleryReminderDeliveries).set({ status: "FAILED", leaseUntil: null,
        nextAttemptAt: null,
        lastError: "L’envoi du mail a échoué." })
        .where(eq(galleryReminderDeliveries.id, claimed.id))
      if (record.ownerUserId) await notify(record.ownerUserId, claimed.galleryId,
        `${claimed.eventKey}:failed:${claimed.contactId}:${claimed.attemptCount}`, `Échec du rappel pour « ${record.title} »`,
        "Le mail n’a pas pu être envoyé. Tu peux le relancer manuellement depuis la galerie.",
        "GALLERY_REMINDER_FAILED")
    }
  }
}

export async function runGalleryReminders(log = console) {
  if (running) return
  running = true
  try {
    await recoverInterrupted()
    await auditDueRules()
    await processQueue(createTransport(), log)
  } finally { running = false }
}

export function startGalleryReminderScheduler(log = console) {
  if (!schedulerEnabled()) return
  if (!createTransport()) log.warn("Gallery reminders: SMTP is not configured; client emails will be skipped")
  runGalleryReminders(log).catch((error) => log.error(error))
  const timer = setInterval(() => runGalleryReminders(log).catch((error) => log.error(error)), 10 * 1000)
  timer.unref()
}

export function checkGalleryRemindersNow(log = console) {
  if (schedulerEnabled()) runGalleryReminders(log).catch((error) => log.error(error))
}
