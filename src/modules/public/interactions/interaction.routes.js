import crypto from "node:crypto"
import { and, desc, eq, gt, gte, isNotNull, isNull, lt, or, sql } from "drizzle-orm"
import { db } from "../../../database/index.js"
import { adminNotifications, galleries, galleryInteractions, photos, users } from "../../../database/schema.js"
import { getAncestorAccess, getInteractionSettings } from "../gallery/gallery.actions.js"
import { isGalleryUnlocked } from "../gallery/downloadAccess.js"
import { sendVerificationMail } from "../../auth/auth.service.js"
import jwt from "jsonwebtoken"
import { prefixReply, sanitizeComment } from "./commentHtml.js"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const allowedReactions = new Set([
  "LOVE", "LIKE", "DISLIKE", "SMILE", "GRIN", "ROFL", "JOY",
  "ANGRY", "VOMIT", "UNAMUSED", "NEUTRAL", "FEAR", "SAD", "HUG",
])
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex")

async function notifyReply(commentId) {
  const [reply] = await db.select({ id: galleryInteractions.id, galleryId: galleryInteractions.galleryId,
    photoId: galleryInteractions.photoId, parentCommentId: galleryInteractions.parentCommentId,
    userId: galleryInteractions.userId, guestEmail: galleryInteractions.guestEmail,
    guestName: galleryInteractions.guestName,
    firstname: users.firstname }).from(galleryInteractions)
    .leftJoin(users, eq(galleryInteractions.userId, users.id)).where(eq(galleryInteractions.id, commentId))
  if (!reply?.parentCommentId) return
  const [parent] = await db.select({ userId: galleryInteractions.userId,
    guestEmail: galleryInteractions.guestEmail }).from(galleryInteractions)
    .where(eq(galleryInteractions.id, reply.parentCommentId))
  if (!parent) return
  let recipientId = parent.userId
  if (!recipientId && parent.guestEmail) {
    const [account] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.email, parent.guestEmail), eq(users.emailConfirmed, true)))
    recipientId = account?.id
  }
  if (!recipientId || recipientId === reply.userId || parent.guestEmail && parent.guestEmail === reply.guestEmail) return
  await db.insert(adminNotifications).values({ ownerUserId: recipientId,
    galleryId: reply.galleryId, photoId: reply.photoId, commentId: reply.id,
    kind: "COMMENT_REPLY", eventKey: `comment-reply:${reply.id}`,
    title: "Réponse à votre commentaire",
    body: `${reply.guestName || reply.firstname || "Quelqu'un"} vous a répondu.` }).onConflictDoNothing()
}
export { notifyReply }

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
    const [account] = await db.select({ id: users.id, email: users.email, firstname: users.firstname, lastname: users.lastname,
      emailConfirmed: users.emailConfirmed, isActive: users.isActive }).from(users).where(eq(users.id, payload.id))
    return account?.isActive && account.emailConfirmed ? account : null
  } catch { return null }
}

function confirmedGuest(request) {
  try {
    const payload = jwt.verify(request.cookies?.guest_interaction_session, process.env.JWT_SECRET)
    return payload.type === "guest_interaction_session" && payload.email ? payload : null
  } catch { return null }
}

export default function interactionRoutes(fastify) {
  fastify.get("/:galleryId", async (request, reply) => {
    const { galleryId } = request.params
    const photoId = request.query?.photoId || null
    if (!uuid.test(galleryId) || (photoId && !uuid.test(photoId))) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    if (!await visibleTarget(request, galleryId, photoId)) return reply.code(404).send({ success: false, message: "Galerie ou photo introuvable" })
    const [gallerySettings] = await db.select({ id: galleries.id, parentGallery: galleries.parentGallery,
      allowReactions: galleries.allowReactions, allowComments: galleries.allowComments })
      .from(galleries).where(eq(galleries.id, galleryId))
    const settings = await getInteractionSettings(gallerySettings)
    const rows = await db.select({ id: galleryInteractions.id, kind: galleryInteractions.kind,
      content: galleryInteractions.content, reaction: galleryInteractions.reaction,
      guestName: galleryInteractions.guestName, guestEmail: galleryInteractions.guestEmail,
      userId: galleryInteractions.userId, avatar: users.avatar,
      parentCommentId: galleryInteractions.parentCommentId, editedAt: galleryInteractions.editedAt,
      firstname: users.firstname, lastname: users.lastname, createdAt: galleryInteractions.createdAt })
      .from(galleryInteractions).leftJoin(users, eq(galleryInteractions.userId, users.id))
      .where(and(eq(galleryInteractions.galleryId, galleryId), photoId ? eq(galleryInteractions.photoId, photoId) : isNull(galleryInteractions.photoId), eq(galleryInteractions.status, "PUBLISHED")))
      .orderBy(desc(galleryInteractions.createdAt)).limit(200)
    const account = await confirmedUser(request)
    const guest = account ? null : confirmedGuest(request)
    const myReaction = settings.allowReactions && (account || guest)
      ? rows.find((row) => row.kind === "REACTION" &&
        (account ? row.userId === account.id || row.guestEmail === account.email : row.guestEmail === guest.email))?.reaction || null
      : null
    const commentReactions = new Map()
    for (const row of rows) if (row.kind === "REACTION" && row.parentCommentId) {
      const current = commentReactions.get(row.parentCommentId) || []
      current.push({ reaction: row.reaction, mine: account ? row.userId === account.id || row.guestEmail === account.email : !!guest && row.guestEmail === guest.email })
      commentReactions.set(row.parentCommentId, current)
    }
    return reply.send({ success: true, myReaction, data: rows.filter((row) =>
      row.kind === "COMMENT" ? settings.allowComments : row.kind === "REACTION" && !row.parentCommentId && settings.allowReactions)
      .map(({ firstname, lastname, guestName, guestEmail, userId, ...row }) => ({
      ...row, author: guestName || [firstname, lastname].filter(Boolean).join(" ") || "Utilisateur",
      mine: account ? userId === account.id || guestEmail === account.email : !!guest && guestEmail === guest.email,
      ...(row.kind === "COMMENT" ? { contentHtml: sanitizeComment(row.content).html,
        reactions: commentReactions.get(row.id) || [] } : {}),
    })) })
  })

  fastify.post("/:galleryId", async (request, reply) => {
    const { galleryId } = request.params
    const body = request.body || {}
    const photoId = body.photoId || null
    const parentCommentId = body.parentCommentId || null
    if (!uuid.test(galleryId) || (photoId && !uuid.test(photoId))) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    if (parentCommentId && !uuid.test(parentCommentId)) return reply.code(400).send({ success: false, message: "Commentaire invalide" })
    if (!await visibleTarget(request, galleryId, photoId)) return reply.code(404).send({ success: false, message: "Galerie ou photo introuvable" })
    if (body.kind !== "COMMENT" && body.kind !== "REACTION") return reply.code(400).send({ success: false, message: "Action invalide" })
    const [gallerySettings] = await db.select({ id: galleries.id, parentGallery: galleries.parentGallery,
      allowReactions: galleries.allowReactions, allowComments: galleries.allowComments })
      .from(galleries).where(eq(galleries.id, galleryId))
    const settings = await getInteractionSettings(gallerySettings)
    if (body.kind === "COMMENT" && !settings.allowComments || body.kind === "REACTION" && !settings.allowReactions) {
      return reply.code(403).send({ success: false, message: "Cette contribution est désactivée pour cette galerie" })
    }
    const parsedContent = body.kind === "COMMENT" ? sanitizeComment(body.content) : null
    const content = parsedContent?.html || null
    const reaction = body.kind === "REACTION" ? body.reaction : null
    let parent = null
    if (parentCommentId) {
      const [found] = await db.select({ id: galleryInteractions.id, photoId: galleryInteractions.photoId,
        userId: galleryInteractions.userId, guestName: galleryInteractions.guestName,
        firstname: users.firstname, lastname: users.lastname }).from(galleryInteractions)
        .leftJoin(users, eq(galleryInteractions.userId, users.id)).where(and(
          eq(galleryInteractions.id, parentCommentId), eq(galleryInteractions.galleryId, galleryId),
          eq(galleryInteractions.kind, "COMMENT"), eq(galleryInteractions.status, "PUBLISHED")))
      if (!found || found.photoId !== photoId) return reply.code(404).send({ success: false, message: "Commentaire introuvable" })
      parent = found
    }
    const replyContent = parent && body.kind === "COMMENT"
      ? prefixReply(content, parent.guestName || [parent.firstname, parent.lastname].filter(Boolean).join(" ") || "Utilisateur") : content
    if (body.kind === "COMMENT" && (!parsedContent.text || parsedContent.text.length > 2000) ||
        body.kind === "REACTION" && !allowedReactions.has(reaction)) {
      return reply.code(400).send({ success: false, message: "Contenu invalide" })
    }
    const account = await confirmedUser(request)
    if (account) {
      if (body.kind === "REACTION") {
        const result = await db.transaction(async (tx) => {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`reaction:${account.id}:${galleryId}:${photoId || "gallery"}:${parentCommentId || "target"}`}))`)
          const scope = and(eq(galleryInteractions.galleryId, galleryId),
            photoId ? eq(galleryInteractions.photoId, photoId) : isNull(galleryInteractions.photoId),
            parentCommentId ? eq(galleryInteractions.parentCommentId, parentCommentId) : isNull(galleryInteractions.parentCommentId),
            or(eq(galleryInteractions.userId, account.id), eq(galleryInteractions.guestEmail, account.email)),
            eq(galleryInteractions.kind, "REACTION"))
          const [existing] = await tx.select({ reaction: galleryInteractions.reaction }).from(galleryInteractions).where(scope)
          await tx.delete(galleryInteractions).where(scope)
          if (existing?.reaction === reaction) return { pending: false, removed: true, reaction: null }
          const [created] = await tx.insert(galleryInteractions).values({ galleryId, photoId, parentCommentId, userId: account.id,
            kind: "REACTION", reaction, status: "PUBLISHED", confirmedAt: new Date() }).returning({ id: galleryInteractions.id })
          return { id: created.id, pending: false, removed: false, reaction }
        })
        return reply.send({ success: true, data: result })
      }
      const [rate] = await db.select({ count: sql`count(*)` }).from(galleryInteractions)
        .where(and(eq(galleryInteractions.userId, account.id), gte(galleryInteractions.createdAt, new Date(Date.now() - 10 * 60 * 1000))))
      if (Number(rate.count) >= 20) return reply.code(429).send({ success: false, message: "Patientez avant une nouvelle contribution" })
      const [created] = await db.insert(galleryInteractions).values({ galleryId, photoId, parentCommentId, userId: account.id,
        kind: body.kind, content: replyContent, reaction, status: "PUBLISHED", confirmedAt: new Date() }).returning({ id: galleryInteractions.id })
      if (parent && body.kind === "COMMENT") await notifyReply(created.id)
      return reply.code(201).send({ success: true, data: { id: created.id, pending: false } })
    }
    return reply.code(401).send({ success: false, message: "Créez un compte et vérifiez votre adresse e-mail pour participer." })
    const guest = confirmedGuest(request)
    const email = guest?.email || String(body.email || "").trim().toLowerCase()
    const guestName = guest?.name || String(body.name || "").trim()
    if (!emailPattern.test(email) || email.length > 254 || guestName.length < 1 || guestName.length > 80) {
      return reply.code(400).send({ success: false, message: "Nom et adresse e-mail valides requis" })
    }
    if (guest) {
      if (body.kind === "REACTION") {
        const result = await db.transaction(async (tx) => {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`reaction:${email}:${galleryId}:${photoId || "gallery"}:${parentCommentId || "target"}`}))`)
          const scope = and(eq(galleryInteractions.galleryId, galleryId),
            photoId ? eq(galleryInteractions.photoId, photoId) : isNull(galleryInteractions.photoId),
            parentCommentId ? eq(galleryInteractions.parentCommentId, parentCommentId) : isNull(galleryInteractions.parentCommentId),
            eq(galleryInteractions.guestEmail, email), eq(galleryInteractions.kind, "REACTION"))
          const [existing] = await tx.select({ reaction: galleryInteractions.reaction }).from(galleryInteractions).where(scope)
          await tx.delete(galleryInteractions).where(scope)
          if (existing?.reaction === reaction) return { pending: false, removed: true, reaction: null }
          const [created] = await tx.insert(galleryInteractions).values({ galleryId, photoId, parentCommentId, guestEmail: email,
            guestName, kind: "REACTION", reaction, status: "PUBLISHED", confirmedAt: new Date() })
            .returning({ id: galleryInteractions.id })
          return { id: created.id, pending: false, removed: false, reaction }
        })
        return reply.send({ success: true, data: result })
      }
      const [rate] = await db.select({ count: sql`count(*)` }).from(galleryInteractions)
        .where(and(eq(galleryInteractions.guestEmail, email), gte(galleryInteractions.createdAt, new Date(Date.now() - 10 * 60 * 1000))))
      if (Number(rate.count) >= 20) return reply.code(429).send({ success: false, message: "Patientez avant une nouvelle contribution" })
      const [created] = await db.insert(galleryInteractions).values({ galleryId, photoId, parentCommentId, guestEmail: email,
        guestName, kind: body.kind, content: replyContent, reaction, status: "PUBLISHED", confirmedAt: new Date() })
        .returning({ id: galleryInteractions.id })
      if (parent && body.kind === "COMMENT") await notifyReply(created.id)
      return reply.code(201).send({ success: true, data: { id: created.id, pending: false } })
    }
    const [rate] = await db.select({ count: sql`count(*)` }).from(galleryInteractions)
      .where(and(eq(galleryInteractions.guestEmail, email), gte(galleryInteractions.createdAt, new Date(Date.now() - 10 * 60 * 1000))))
    if (Number(rate.count) >= 10) return reply.code(429).send({ success: false, message: "Patientez avant une nouvelle contribution" })
    const [pending] = await db.select({ id: galleryInteractions.id, verificationExpiresAt: galleryInteractions.verificationExpiresAt }).from(galleryInteractions)
      .where(and(eq(galleryInteractions.guestEmail, email), eq(galleryInteractions.status, "PENDING"),
        isNotNull(galleryInteractions.verificationTokenHash), gt(galleryInteractions.verificationExpiresAt, new Date())))
      .limit(1)
    if (pending) {
      if (body.kind === "REACTION") {
        const scope = and(eq(galleryInteractions.galleryId, galleryId),
          photoId ? eq(galleryInteractions.photoId, photoId) : isNull(galleryInteractions.photoId),
          parentCommentId ? eq(galleryInteractions.parentCommentId, parentCommentId) : isNull(galleryInteractions.parentCommentId),
          eq(galleryInteractions.guestEmail, email), eq(galleryInteractions.kind, "REACTION"),
          eq(galleryInteractions.status, "PENDING"), isNull(galleryInteractions.verificationTokenHash))
        const [existing] = await db.select({ reaction: galleryInteractions.reaction }).from(galleryInteractions).where(scope)
        await db.delete(galleryInteractions).where(scope)
        if (existing?.reaction === reaction) return reply.send({ success: true, data: { pending: true, removed: true, emailSent: false } })
        const [tokenReaction] = await db.select({ id: galleryInteractions.id,
          reaction: galleryInteractions.reaction }).from(galleryInteractions).where(and(
          eq(galleryInteractions.galleryId, galleryId),
          photoId ? eq(galleryInteractions.photoId, photoId) : isNull(galleryInteractions.photoId),
          parentCommentId ? eq(galleryInteractions.parentCommentId, parentCommentId) : isNull(galleryInteractions.parentCommentId),
          eq(galleryInteractions.guestEmail, email), eq(galleryInteractions.kind, "REACTION"),
          eq(galleryInteractions.status, "PENDING"), isNotNull(galleryInteractions.verificationTokenHash)))
        if (tokenReaction) {
          await db.update(galleryInteractions).set(tokenReaction.reaction === reaction
            ? { kind: "VERIFY", reaction: null } : { reaction }).where(eq(galleryInteractions.id, tokenReaction.id))
          return reply.send({ success: true, data: { pending: true,
            removed: tokenReaction.reaction === reaction, emailSent: false } })
        }
      }
      const [queued] = await db.insert(galleryInteractions).values({ galleryId, photoId, parentCommentId, guestEmail: email,
        guestName, kind: body.kind, content: replyContent, reaction, status: "PENDING",
        verificationExpiresAt: pending.verificationExpiresAt }).returning({ id: galleryInteractions.id })
      return reply.code(202).send({ success: true, data: { id: queued.id, pending: true, emailSent: false } })
    }
    const [created] = await db.insert(galleryInteractions).values({ galleryId, photoId, parentCommentId, guestEmail: email,
      guestName, kind: body.kind, content: replyContent, reaction, status: "PENDING",
      verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }).returning({ id: galleryInteractions.id })
    const token = await reply.jwtSign({ type: "guest_interaction_verification", interactionId: created.id, email },
      { expiresIn: "24h" })
    await db.update(galleryInteractions).set({ verificationTokenHash: hash(token) })
      .where(eq(galleryInteractions.id, created.id))
    const url = `${process.env.FRONTEND_URL}/confirmer-interaction?token=${encodeURIComponent(token)}`
    try { await sendVerificationMail({ email, firstname: guestName }, url, { guestInteraction: true }) } catch (error) {
      await db.delete(galleryInteractions).where(eq(galleryInteractions.id, created.id))
      request.log.error(error)
      return reply.code(503).send({ success: false, message: "Impossible d'envoyer le courriel de confirmation" })
    }
    return reply.code(202).send({ success: true, data: { pending: true, emailSent: true } })
  })

  fastify.patch("/:galleryId/comments/:commentId", async (request, reply) => {
    const { galleryId, commentId } = request.params
    if (!uuid.test(galleryId) || !uuid.test(commentId) || !await visibleTarget(request, galleryId, null)) {
      return reply.code(404).send({ success: false, message: "Commentaire introuvable" })
    }
    const parsedContent = sanitizeComment(request.body?.content)
    const content = parsedContent.html
    if (!parsedContent.text || parsedContent.text.length > 2000) return reply.code(400).send({ success: false, message: "Commentaire invalide" })
    const account = await confirmedUser(request)
    const guest = account ? null : confirmedGuest(request)
    if (!account && !guest) return reply.code(401).send({ success: false, message: "Connexion ou adresse vérifiée requise" })
    const [updated] = await db.update(galleryInteractions).set({ content, editedAt: new Date() })
      .where(and(eq(galleryInteractions.id, commentId), eq(galleryInteractions.galleryId, galleryId),
        eq(galleryInteractions.kind, "COMMENT"), eq(galleryInteractions.status, "PUBLISHED"),
        account ? or(eq(galleryInteractions.userId, account.id), eq(galleryInteractions.guestEmail, account.email)) : eq(galleryInteractions.guestEmail, guest.email)))
      .returning({ id: galleryInteractions.id })
    if (!updated) return reply.code(404).send({ success: false, message: "Commentaire introuvable" })
    return reply.send({ success: true })
  })

  fastify.delete("/:galleryId/comments/:commentId", async (request, reply) => {
    const { galleryId, commentId } = request.params
    if (!uuid.test(galleryId) || !uuid.test(commentId) || !await visibleTarget(request, galleryId, null)) {
      return reply.code(404).send({ success: false, message: "Commentaire introuvable" })
    }
    const account = await confirmedUser(request)
    const guest = account ? null : confirmedGuest(request)
    if (!account && !guest) return reply.code(401).send({ success: false, message: "Connexion ou adresse vérifiée requise" })
    const [removed] = await db.update(galleryInteractions).set({ status: "DELETED", content: null })
      .where(and(eq(galleryInteractions.id, commentId), eq(galleryInteractions.galleryId, galleryId),
        eq(galleryInteractions.kind, "COMMENT"), eq(galleryInteractions.status, "PUBLISHED"),
        account ? or(eq(galleryInteractions.userId, account.id), eq(galleryInteractions.guestEmail, account.email)) : eq(galleryInteractions.guestEmail, guest.email)))
      .returning({ id: galleryInteractions.id })
    if (!removed) return reply.code(404).send({ success: false, message: "Commentaire introuvable" })
    await db.delete(galleryInteractions).where(and(eq(galleryInteractions.parentCommentId, commentId),
      eq(galleryInteractions.kind, "REACTION")))
    return reply.send({ success: true })
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
      .returning({ id: galleryInteractions.id, galleryId: galleryInteractions.galleryId, email: galleryInteractions.guestEmail,
        name: galleryInteractions.guestName })
    if (!confirmed) return reply.code(410).send({ success: false, message: "Lien expiré ou déjà utilisé" })
    const published = await db.update(galleryInteractions).set({ status: "PUBLISHED", confirmedAt: new Date(),
      verificationExpiresAt: null }).where(and(eq(galleryInteractions.guestEmail, confirmed.email),
      eq(galleryInteractions.status, "PENDING"), gt(galleryInteractions.verificationExpiresAt, new Date())))
      .returning({ id: galleryInteractions.id })
    for (const item of [confirmed, ...published]) await notifyReply(item.id)
    const guestSession = await reply.jwtSign({ type: "guest_interaction_session",
      email: confirmed.email, name: confirmed.name }, { expiresIn: "30d" })
    reply.setCookie("guest_interaction_session", guestSession, { httpOnly: true,
      secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60 })
    return reply.send({ success: true, data: { galleryId: confirmed.galleryId } })
  })
}
