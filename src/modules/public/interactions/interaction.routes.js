import crypto from "node:crypto"
import nodemailer from "nodemailer"
import { and, desc, eq, gt, gte, isNull, lt, sql } from "drizzle-orm"
import { db } from "../../../database/index.js"
import { galleries, galleryInteractions, photos, users } from "../../../database/schema.js"
import { getAncestorAccess } from "../gallery/gallery.actions.js"
import { isGalleryUnlocked } from "../gallery/downloadAccess.js"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const allowedReactions = new Set(["LIKE", "LOVE", "WOW"])
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex")

export async function cleanupPendingInteractions() {
  await db.delete(galleryInteractions).where(and(eq(galleryInteractions.status, "PENDING"),
    lt(galleryInteractions.verificationExpiresAt, new Date())))
}

export async function visibleTarget(request, galleryId, photoId) {
  const [gallery] = await db.select({ id: galleries.id, parentGallery: galleries.parentGallery, visibility: galleries.visibility })
    .from(galleries).where(eq(galleries.id, galleryId))
  if (!gallery || gallery.visibility === "HIDDEN" || (await getAncestorAccess(gallery, request)).blocked ||
      (gallery.visibility === "PRIVATE" && !isGalleryUnlocked(gallery, request))) return false
  if (!photoId) return true
  const [photo] = await db.select({ id: photos.id }).from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.galleryId, galleryId), eq(photos.isHidden, false)))
  return !!photo
}

export async function confirmedUser(request) {
  const token = request.cookies?.access_token
  if (!token) return null
  try {
    const payload = await request.jwtVerify(token)
    const [account] = await db.select({ id: users.id, firstname: users.firstname, lastname: users.lastname,
      emailConfirmed: users.emailConfirmed, isActive: users.isActive }).from(users).where(eq(users.id, payload.id))
    return account?.isActive && account.emailConfirmed ? account : null
  } catch { return null }
}

async function sendConfirmation(email, token) {
  const transport = nodemailer.createTransport({ host: process.env.SMTP_SERVER,
    port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD } })
  const url = `${process.env.FRONTEND_URL}/confirmer-interaction?token=${encodeURIComponent(token)}`
  await transport.sendMail({ from: `Pitaya Photo <${process.env.SMTP_FROM || "noreply@pitaya-photo.com"}>`,
    to: email, subject: "Confirmez votre contribution à une galerie Pitaya Photo",
    text: `Confirmez votre adresse pour publier votre réaction ou commentaire : ${url}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    html: `<p>Confirmez votre adresse pour publier votre réaction ou commentaire.</p><p><a href="${url}">Confirmer ma contribution</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
  })
}

export default function interactionRoutes(fastify) {
  fastify.get("/:galleryId", async (request, reply) => {
    const { galleryId } = request.params
    const photoId = request.query?.photoId || null
    if (!uuid.test(galleryId) || (photoId && !uuid.test(photoId))) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    if (!await visibleTarget(request, galleryId, photoId)) return reply.code(404).send({ success: false, message: "Galerie ou photo introuvable" })
    const rows = await db.select({ id: galleryInteractions.id, kind: galleryInteractions.kind,
      content: galleryInteractions.content, reaction: galleryInteractions.reaction,
      guestName: galleryInteractions.guestName, firstname: users.firstname, lastname: users.lastname,
      createdAt: galleryInteractions.createdAt })
      .from(galleryInteractions).leftJoin(users, eq(galleryInteractions.userId, users.id))
      .where(and(eq(galleryInteractions.galleryId, galleryId), photoId ? eq(galleryInteractions.photoId, photoId) : isNull(galleryInteractions.photoId), eq(galleryInteractions.status, "PUBLISHED")))
      .orderBy(desc(galleryInteractions.createdAt)).limit(200)
    return reply.send({ success: true, data: rows.map(({ firstname, lastname, guestName, ...row }) => ({
      ...row, author: guestName || [firstname, lastname].filter(Boolean).join(" ") || "Utilisateur",
    })) })
  })

  fastify.post("/:galleryId", async (request, reply) => {
    const { galleryId } = request.params
    const body = request.body || {}
    const photoId = body.photoId || null
    if (!uuid.test(galleryId) || (photoId && !uuid.test(photoId))) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    if (!await visibleTarget(request, galleryId, photoId)) return reply.code(404).send({ success: false, message: "Galerie ou photo introuvable" })
    if (body.kind !== "COMMENT" && body.kind !== "REACTION") return reply.code(400).send({ success: false, message: "Action invalide" })
    const content = body.kind === "COMMENT" ? String(body.content || "").trim() : null
    const reaction = body.kind === "REACTION" ? body.reaction : null
    if (body.kind === "COMMENT" && (content.length < 1 || content.length > 2000) ||
        body.kind === "REACTION" && !allowedReactions.has(reaction)) {
      return reply.code(400).send({ success: false, message: "Contenu invalide" })
    }
    const account = await confirmedUser(request)
    if (account) {
      const [rate] = await db.select({ count: sql`count(*)` }).from(galleryInteractions)
        .where(and(eq(galleryInteractions.userId, account.id), gte(galleryInteractions.createdAt, new Date(Date.now() - 10 * 60 * 1000))))
      if (Number(rate.count) >= 20) return reply.code(429).send({ success: false, message: "Patientez avant une nouvelle contribution" })
      if (body.kind === "REACTION") {
        const [existing] = await db.select({ id: galleryInteractions.id }).from(galleryInteractions)
          .where(and(eq(galleryInteractions.galleryId, galleryId), photoId ? eq(galleryInteractions.photoId, photoId) : isNull(galleryInteractions.photoId),
            eq(galleryInteractions.userId, account.id), eq(galleryInteractions.kind, "REACTION"), eq(galleryInteractions.reaction, reaction)))
        if (existing) return reply.send({ success: true, data: { id: existing.id, pending: false } })
      }
      const [created] = await db.insert(galleryInteractions).values({ galleryId, photoId, userId: account.id,
        kind: body.kind, content, reaction, status: "PUBLISHED", confirmedAt: new Date() }).returning({ id: galleryInteractions.id })
      return reply.code(201).send({ success: true, data: { id: created.id, pending: false } })
    }
    const email = String(body.email || "").trim().toLowerCase()
    const guestName = String(body.name || "").trim()
    if (!emailPattern.test(email) || email.length > 254 || guestName.length < 1 || guestName.length > 80) {
      return reply.code(400).send({ success: false, message: "Nom et adresse e-mail valides requis" })
    }
    const [rate] = await db.select({ count: sql`count(*)` }).from(galleryInteractions)
      .where(and(eq(galleryInteractions.guestEmail, email), gte(galleryInteractions.createdAt, new Date(Date.now() - 10 * 60 * 1000))))
    if (Number(rate.count) >= 3) return reply.code(429).send({ success: false, message: "Patientez avant une nouvelle demande" })
    const token = crypto.randomBytes(32).toString("base64url")
    const [created] = await db.insert(galleryInteractions).values({ galleryId, photoId, guestEmail: email,
      guestName, kind: body.kind, content, reaction, status: "PENDING", verificationTokenHash: hash(token),
      verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }).returning({ id: galleryInteractions.id })
    try { await sendConfirmation(email, token) } catch (error) {
      await db.delete(galleryInteractions).where(eq(galleryInteractions.id, created.id))
      request.log.error(error)
      return reply.code(503).send({ success: false, message: "Impossible d'envoyer le courriel de confirmation" })
    }
    return reply.code(202).send({ success: true, data: { pending: true } })
  })

  fastify.post("/confirm", async (request, reply) => {
    const token = request.body?.token
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
      return reply.code(400).send({ success: false, message: "Lien invalide" })
    }
    const [confirmed] = await db.update(galleryInteractions).set({ status: "PUBLISHED", confirmedAt: new Date(),
      verificationTokenHash: null, verificationExpiresAt: null })
      .where(and(eq(galleryInteractions.verificationTokenHash, hash(token)), eq(galleryInteractions.status, "PENDING"),
        gt(galleryInteractions.verificationExpiresAt, new Date())))
      .returning({ galleryId: galleryInteractions.galleryId })
    if (!confirmed) return reply.code(410).send({ success: false, message: "Lien expiré ou déjà utilisé" })
    return reply.send({ success: true, data: { galleryId: confirmed.galleryId } })
  })
}
