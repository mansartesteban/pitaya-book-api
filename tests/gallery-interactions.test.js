import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import Fastify from "fastify"
import fastifyCookie from "@fastify/cookie"
import fastifyJwt from "@fastify/jwt"
import { eq } from "drizzle-orm"
import { db } from "../src/database/index.js"
import { companies, companyContacts, galleries, galleryInteractions, galleryManagerGrants, photos, users } from "../src/database/schema.js"
import interactionRoutes from "../src/modules/public/interactions/interaction.routes.js"
import memberRoutes from "../src/modules/member/member.routes.js"
import memberLibraryRoutes from "../src/modules/member/memberLibrary.routes.js"
import userRoutes from "../src/modules/user/user.routes.js"

const localDatabase = (() => {
  try { return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname) }
  catch { return false }
})()

test.after(async () => { await db.$client.end() })

test("confirmed comments can be moderated without exposing hidden comments", { skip: !localDatabase }, async () => {
  const app = Fastify()
  app.register(fastifyCookie)
  app.register(fastifyJwt, { secret: process.env.JWT_SECRET, cookie: { cookieName: "access_token", signed: false } })
  app.register(interactionRoutes, { prefix: "/api/public/interactions" })
  app.register(memberRoutes, { prefix: "/api/member" })
  app.register(memberLibraryRoutes, { prefix: "/api/member/library" })
  app.register(userRoutes, { prefix: "/api/users" })
  const [account] = await db.insert(users).values({ email: `test-${crypto.randomUUID()}@example.invalid`,
    firstname: "Test", lastname: "User", role: "USER", emailConfirmed: true }).returning({ id: users.id })
  const [gallery] = await db.insert(galleries).values({ name: "integration-test", title: "Integration test",
    slug: `integration-${crypto.randomUUID()}`, visibility: "PUBLIC", ownerUserId: account.id }).returning({ id: galleries.id })
  let companyId = null
  let memberId = null
  try {
    assert.match(gallery.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    await app.ready()
    const token = app.jwt.sign({ id: account.id, role: "USER" })
    const cookie = `access_token=${token}`
    const post = await app.inject({ method: "POST", url: `/api/public/interactions/${gallery.id}`,
      headers: { cookie }, payload: { kind: "COMMENT", content: "Test comment" } })
    assert.equal(post.statusCode, 201, post.body)
    const commentId = post.json().data.id
    const before = await app.inject({ method: "GET", url: `/api/public/interactions/${gallery.id}` })
    assert.equal(before.json().data.length, 1)
    const hide = await app.inject({ method: "PATCH", url: `/api/member/galleries/${gallery.id}/comments/${commentId}/visibility`,
      headers: { cookie }, payload: { hidden: true } })
    assert.equal(hide.statusCode, 200, hide.body)
    const after = await app.inject({ method: "GET", url: `/api/public/interactions/${gallery.id}` })
    assert.equal(after.json().data.length, 0)

    const guestToken = crypto.randomBytes(32).toString("base64url")
    await db.insert(galleryInteractions).values({ galleryId: gallery.id, kind: "COMMENT", content: "Guest comment",
      guestEmail: "guest@example.invalid", guestName: "Guest", status: "PENDING",
      verificationTokenHash: crypto.createHash("sha256").update(guestToken).digest("hex"),
      verificationExpiresAt: new Date(Date.now() + 60 * 60 * 1000) })
    const pending = await app.inject({ method: "GET", url: `/api/public/interactions/${gallery.id}` })
    assert.equal(pending.json().data.length, 0)
    const confirm = await app.inject({ method: "POST", url: "/api/public/interactions/confirm", payload: { token: guestToken } })
    assert.equal(confirm.statusCode, 200, confirm.body)
    const confirmed = await app.inject({ method: "GET", url: `/api/public/interactions/${gallery.id}` })
    assert.equal(confirmed.json().data.length, 1)
    const replay = await app.inject({ method: "POST", url: "/api/public/interactions/confirm", payload: { token: guestToken } })
    assert.equal(replay.statusCode, 410)

    const [photo] = await db.insert(photos).values({ galleryId: gallery.id, extension: "jpg", url: "unused",
      size: 1, width: 1, height: 1, ratio: "1" }).returning({ id: photos.id })
    const visiblePhoto = await app.inject({ method: "GET", url: `/api/public/interactions/${gallery.id}?photoId=${photo.id}` })
    assert.equal(visiblePhoto.statusCode, 200)
    const hidden = await app.inject({ method: "PATCH", url: `/api/member/galleries/${gallery.id}/photos/${photo.id}/visibility`,
      headers: { cookie }, payload: { hidden: true } })
    assert.equal(hidden.statusCode, 200, hidden.body)
    const hiddenPhoto = await app.inject({ method: "GET", url: `/api/public/interactions/${gallery.id}?photoId=${photo.id}` })
    assert.equal(hiddenPhoto.statusCode, 404)

    const memberEmail = `member-${crypto.randomUUID()}@example.invalid`
    const [member] = await db.insert(users).values({ email: memberEmail, role: "USER", emailConfirmed: true })
      .returning({ id: users.id })
    memberId = member.id
    const [company] = await db.insert(companies).values({ name: "Test company", userId: account.id })
      .returning({ id: companies.id })
    companyId = company.id
    const [contact] = await db.insert(companyContacts).values({ companyId, firstname: "Test", lastname: "Member", email: memberEmail })
      .returning({ id: companyContacts.id })
    await db.update(galleries).set({ clientCompanyId: companyId }).where(eq(galleries.id, gallery.id))
    await db.insert(galleryManagerGrants).values({ galleryId: gallery.id, contactId: contact.id, grantedByUserId: account.id })
    const memberCookie = `access_token=${app.jwt.sign({ id: member.id, role: "USER" })}`
    const managed = await app.inject({ method: "GET", url: "/api/users/me/managed-galleries", headers: { cookie: memberCookie } })
    assert.equal(managed.statusCode, 200, managed.body)
    assert.equal(managed.json().data[0].id, gallery.id)
    const unhide = await app.inject({ method: "PATCH", url: `/api/member/galleries/${gallery.id}/photos/${photo.id}/visibility`,
      headers: { cookie: memberCookie }, payload: { hidden: false } })
    assert.equal(unhide.statusCode, 200, unhide.body)

    const favorite = await app.inject({ method: "PUT", url: `/api/member/library/photos/${photo.id}`, headers: { cookie: memberCookie } })
    assert.equal(favorite.statusCode, 200, favorite.body)
    const selectionResponse = await app.inject({ method: "POST", url: "/api/member/library/selections", headers: { cookie: memberCookie },
      payload: { name: "My selection" } })
    assert.equal(selectionResponse.statusCode, 201, selectionResponse.body)
    const selectionId = selectionResponse.json().data.id
    const add = await app.inject({ method: "PUT", url: `/api/member/library/selections/${selectionId}/photos/${photo.id}`,
      headers: { cookie: memberCookie } })
    assert.equal(add.statusCode, 200, add.body)
    const selected = await app.inject({ method: "GET", url: `/api/member/library/selections/${selectionId}`, headers: { cookie: memberCookie } })
    assert.equal(selected.json().data.photos.length, 1)
    await app.inject({ method: "PATCH", url: `/api/member/galleries/${gallery.id}/photos/${photo.id}/visibility`,
      headers: { cookie: memberCookie }, payload: { hidden: true } })
    const hiddenSelection = await app.inject({ method: "GET", url: `/api/member/library/selections/${selectionId}`, headers: { cookie: memberCookie } })
    assert.equal(hiddenSelection.json().data.photos.length, 0)
  } finally {
    await app.close()
    await db.delete(galleries).where(eq(galleries.id, gallery.id))
    if (companyId) await db.delete(companies).where(eq(companies.id, companyId))
    if (memberId) await db.delete(users).where(eq(users.id, memberId))
    await db.delete(users).where(eq(users.id, account.id))
  }
})
