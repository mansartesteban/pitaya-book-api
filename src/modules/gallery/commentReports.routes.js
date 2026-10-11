import { and, desc, eq } from "drizzle-orm"
import { db } from "../../database/index.js"
import { commentReports, galleries, galleryInteractions, users } from "../../database/schema.js"
import { authenticationMiddleware, adminMiddleware } from "../../lib/middlewares/authentication.js"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function commentReportsRoutes(fastify) {
  fastify.addHook("preHandler", authenticationMiddleware)
  fastify.addHook("preHandler", adminMiddleware)

  fastify.get("/", async (_request, reply) => {
    const rows = await db.select({ id: commentReports.id, commentId: commentReports.commentId,
      createdAt: commentReports.createdAt, content: galleryInteractions.content,
      galleryId: galleryInteractions.galleryId, photoId: galleryInteractions.photoId,
      galleryTitle: galleries.title, gallerySlug: galleries.slug,
      reporterFirstname: users.firstname, reporterLastname: users.lastname, reporterEmail: users.email,
    }).from(commentReports)
      .innerJoin(galleryInteractions, eq(commentReports.commentId, galleryInteractions.id))
      .innerJoin(galleries, eq(galleryInteractions.galleryId, galleries.id))
      .innerJoin(users, eq(commentReports.reporterUserId, users.id))
      .where(eq(commentReports.status, "PENDING"))
      .orderBy(desc(commentReports.createdAt)).limit(200)
    return reply.send({ success: true, data: rows })
  })

  fastify.post("/:reportId/dismiss", async (request, reply) => {
    if (!uuid.test(request.params.reportId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    const [updated] = await db.update(commentReports).set({ status: "DISMISSED", reviewedAt: new Date() })
      .where(and(eq(commentReports.id, request.params.reportId), eq(commentReports.status, "PENDING")))
      .returning({ id: commentReports.id })
    if (!updated) return reply.code(404).send({ success: false, message: "Signalement introuvable" })
    return reply.send({ success: true })
  })

  fastify.post("/:reportId/remove-comment", async (request, reply) => {
    if (!uuid.test(request.params.reportId)) return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    const [report] = await db.select({ commentId: commentReports.commentId }).from(commentReports)
      .where(and(eq(commentReports.id, request.params.reportId), eq(commentReports.status, "PENDING")))
    if (!report) return reply.code(404).send({ success: false, message: "Signalement introuvable" })
    await db.transaction(async (tx) => {
      await tx.update(galleryInteractions).set({ status: "DELETED", content: null })
        .where(and(eq(galleryInteractions.id, report.commentId), eq(galleryInteractions.kind, "COMMENT")))
      await tx.delete(galleryInteractions).where(and(eq(galleryInteractions.parentCommentId, report.commentId),
        eq(galleryInteractions.kind, "REACTION")))
      await tx.update(commentReports).set({ status: "REMOVED", reviewedAt: new Date() })
        .where(eq(commentReports.commentId, report.commentId))
    })
    return reply.send({ success: true })
  })
}
