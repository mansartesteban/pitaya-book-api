import { and, asc, eq, lte } from "drizzle-orm"
import { db } from "../../database/index.js"
import { articles } from "../../database/schema.js"
import { authenticationMiddleware } from "../../lib/middlewares/authentication.js"

const adminOnly = async (request, reply) => {
  const isOwner = request.user?.email === "esteban.mansart@gmail.com"
  if (!isOwner && !["ADMIN", "SUPERADMIN"].includes(request.user?.role)) {
    return reply.code(403).send({ error: "Accès réservé à l'administration" })
  }
}

const toPayload = (row) => ({
  ...row.content,
  id: row.id,
  slug: row.slug,
  title: row.title,
  publishedAt: row.publishedAt?.toISOString() ?? null,
  isDraft: row.isDraft,
  createdAt: row.createdAt?.toISOString(),
  updatedAt: row.updatedAt?.toISOString(),
})

const validate = (body) => {
  if (!body || typeof body !== "object") return "Données invalides"
  if (typeof body.title !== "string" || !body.title.trim()) return "Titre requis"
  if (typeof body.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)) return "Slug invalide"
  if (typeof body.category !== "string" || !body.category.trim()) return "Catégorie requise"
  if (typeof body.excerpt !== "string" || !body.excerpt.trim()) return "Résumé requis"
  if (!Array.isArray(body.introduction) || !body.introduction.length || body.introduction.some((item) => typeof item?.text !== "string")) return "Introduction invalide"
  if (!Array.isArray(body.sections) || !body.sections.length || body.sections.some((section) => typeof section?.title !== "string" || !Array.isArray(section.paragraphs) || section.paragraphs.some((item) => typeof item?.text !== "string"))) return "Sections invalides"
  if (body.visual != null && (typeof body.visual !== "object" || ["eyebrow", "headline", "text"].some((key) => typeof body.visual[key] !== "string"))) return "Encadré invalide"
  if (body.pullQuote != null && typeof body.pullQuote !== "string") return "Citation invalide"
  if (!Array.isArray(body.sources) || body.sources.some((source) => !source || ["id", "label", "url"].some((key) => typeof source[key] !== "string"))) return "Sources invalides"
  if (body.sources.some((source) => !/^https?:\/\//i.test(source.url))) return "Les sources doivent utiliser une adresse web valide"
  if (!Number.isInteger(body.readingTime) || body.readingTime < 1 || body.readingTime > 120) return "Temps de lecture invalide"
  if (!Number.isInteger(body.interest) || body.interest < 1 || body.interest > 5) return "Intérêt invalide"
  if (typeof body.isDraft !== "boolean") return "État invalide"
  if (!body.isDraft && (!body.publishedAt || Number.isNaN(new Date(body.publishedAt).getTime()))) return "Date de publication requise"
  if (body.publishedAt && Number.isNaN(new Date(body.publishedAt).getTime())) return "Date de publication invalide"
  return null
}

const fields = (body) => {
  const { slug, title, publishedAt, isDraft, id, createdAt, updatedAt, ...content } = body
  return {
    slug,
    title: title.trim(),
    publishedAt: publishedAt ? new Date(publishedAt) : null,
    isDraft,
    content,
    updatedAt: new Date(),
  }
}

export default async function articleRoutes(app) {
  app.get("/public/articles", async (_request, reply) => {
    const rows = await db.select().from(articles)
      .where(and(eq(articles.isDraft, false), lte(articles.publishedAt, new Date())))
      .orderBy(asc(articles.publishedAt))
    return rows.map(toPayload)
  })

  app.get("/public/articles/:slug", async (request, reply) => {
    const [row] = await db.select().from(articles)
      .where(and(eq(articles.slug, request.params.slug), eq(articles.isDraft, false), lte(articles.publishedAt, new Date())))
    if (!row) return reply.code(404).send({ error: "Article introuvable" })
    return toPayload(row)
  })

  app.register(async (admin) => {
    admin.addHook("preHandler", authenticationMiddleware)
    admin.addHook("preHandler", adminOnly)

    admin.get("/", async () => {
      const rows = await db.select().from(articles).orderBy(asc(articles.publishedAt))
      return rows.map(toPayload)
    })

    admin.post("/", async (request, reply) => {
      const error = validate(request.body)
      if (error) return reply.code(400).send({ error })
      const [existing] = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, request.body.slug))
      if (existing) return reply.code(409).send({ error: "Ce slug existe déjà" })
      const [created] = await db.insert(articles).values(fields(request.body)).returning()
      return reply.code(201).send(toPayload(created))
    })

    admin.put("/:id", async (request, reply) => {
      const error = validate(request.body)
      if (error) return reply.code(400).send({ error })
      const [current] = await db.select({ slug: articles.slug }).from(articles).where(eq(articles.id, request.params.id))
      if (!current) return reply.code(404).send({ error: "Article introuvable" })
      if (current.slug !== request.body.slug) return reply.code(400).send({ error: "L'adresse d'un article existant ne peut pas changer" })
      const [existing] = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, request.body.slug))
      if (existing && existing.id !== request.params.id) return reply.code(409).send({ error: "Ce slug existe déjà" })
      const [updated] = await db.update(articles).set(fields(request.body)).where(eq(articles.id, request.params.id)).returning()
      if (!updated) return reply.code(404).send({ error: "Article introuvable" })
      return toPayload(updated)
    })

    admin.delete("/:id", async (request, reply) => {
      const [deleted] = await db.delete(articles).where(eq(articles.id, request.params.id)).returning({ id: articles.id })
      if (!deleted) return reply.code(404).send({ error: "Article introuvable" })
      return { success: true }
    })
  }, { prefix: "/articles" })
}
