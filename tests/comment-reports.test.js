import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import Fastify from "fastify"
import fastifyCookie from "@fastify/cookie"
import fastifyJwt from "@fastify/jwt"
import { eq } from "drizzle-orm"
import { db } from "../src/database/index.js"
import { galleries, galleryInteractions, users } from "../src/database/schema.js"
import interactionRoutes from "../src/modules/public/interactions/interaction.routes.js"
import commentReportsRoutes from "../src/modules/gallery/commentReports.routes.js"

const localDatabase = (() => {
  try { return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname) }
  catch { return false }
})()
test.after(async () => { await db.$client.end() })

test("a confirmed user reports once and only admin reviews or removes the comment", { skip: !localDatabase }, async () => {
  const priorMailSetting = process.env.COMMENT_REPORT_MAIL_ENABLED
  process.env.COMMENT_REPORT_MAIL_ENABLED = 'false'
  const app = Fastify()
  app.register(fastifyCookie)
  app.register(fastifyJwt, { secret: process.env.JWT_SECRET, cookie: { cookieName: "access_token", signed: false } })
  app.register(interactionRoutes, { prefix: "/public/interactions" })
  app.register(commentReportsRoutes, { prefix: "/comment-reports" })
  await app.ready()
  const suffix = crypto.randomUUID()
  const [owner, reporter] = await db.insert(users).values([
    { email: `owner-${suffix}@example.invalid`, firstname: "Owner", lastname: "Test", role: "ADMIN", emailConfirmed: true },
    { email: `reporter-${suffix}@example.invalid`, firstname: "Reporter", lastname: "Test", role: "USER", emailConfirmed: true },
  ]).returning({ id: users.id, email: users.email })
  const [gallery] = await db.insert(galleries).values({ name: `reports-${suffix}`, title: "Reports test",
    slug: `reports-${suffix}`, visibility: "PUBLIC", ownerUserId: owner.id }).returning({ id: galleries.id })
  const [comment] = await db.insert(galleryInteractions).values({ galleryId: gallery.id, userId: owner.id,
    kind: "COMMENT", content: "Comment to review", status: "PUBLISHED", confirmedAt: new Date() })
    .returning({ id: galleryInteractions.id })
  const ownerCookie = `access_token=${app.jwt.sign({ id: owner.id, role: "ADMIN" })}`
  const reporterCookie = `access_token=${app.jwt.sign({ id: reporter.id, role: "USER" })}`
  try {
    const url = `/public/interactions/${gallery.id}/comments/${comment.id}/report`
    assert.equal((await app.inject({ method: "POST", url })).statusCode, 401)
    assert.equal((await app.inject({ method: "POST", url, headers: { cookie: reporterCookie } })).statusCode, 200)
    assert.equal((await app.inject({ method: "POST", url, headers: { cookie: reporterCookie } })).statusCode, 200)
    const interactions = await app.inject({ method: "GET", url: `/public/interactions/${gallery.id}`,
      headers: { cookie: reporterCookie } })
    assert.equal(interactions.statusCode, 200, interactions.body)
    assert.equal(interactions.json().data.find((item) => item.id === comment.id).reportedByMe, true)
    assert.equal((await app.inject({ method: "GET", url: "/comment-reports", headers: { cookie: reporterCookie } })).statusCode, 403)
    const listed = await app.inject({ method: "GET", url: "/comment-reports", headers: { cookie: ownerCookie } })
    assert.equal(listed.statusCode, 200, listed.body)
    const matches = listed.json().data.filter((item) => item.commentId === comment.id)
    assert.equal(matches.length, 1)
    assert.equal(matches[0].reporterEmail, reporter.email)
    assert.equal((await app.inject({ method: "POST", url: `/comment-reports/${matches[0].id}/dismiss`,
      headers: { cookie: ownerCookie } })).statusCode, 200)
    assert.equal((await app.inject({ method: "POST", url, headers: { cookie: reporterCookie } })).statusCode, 200)
    const reopened = await app.inject({ method: "GET", url: "/comment-reports", headers: { cookie: ownerCookie } })
    assert.equal(reopened.json().data.filter((item) => item.commentId === comment.id).length, 1)
    assert.equal((await app.inject({ method: "POST", url: `/comment-reports/${matches[0].id}/remove-comment`,
      headers: { cookie: ownerCookie } })).statusCode, 200)
    const [removed] = await db.select({ status: galleryInteractions.status }).from(galleryInteractions)
      .where(eq(galleryInteractions.id, comment.id))
    assert.equal(removed.status, "DELETED")
  } finally {
    if (priorMailSetting === undefined) delete process.env.COMMENT_REPORT_MAIL_ENABLED
    else process.env.COMMENT_REPORT_MAIL_ENABLED = priorMailSetting
    await app.close()
    await db.delete(galleries).where(eq(galleries.id, gallery.id))
    await db.delete(users).where(eq(users.id, reporter.id))
    await db.delete(users).where(eq(users.id, owner.id))
  }
})
