import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import Fastify from "fastify"
import fastifyCookie from "@fastify/cookie"
import fastifyJwt from "@fastify/jwt"
import { db } from "../src/database/index.js"
import { companies, companyContacts, galleries, galleryManagerInvitations, users } from "../src/database/schema.js"
import { eq } from "drizzle-orm"
import { authenticationMiddleware } from "../src/lib/middlewares/authentication.js"
import { addUnifiedGalleryManager, listUnifiedGalleryManagers, removeUnifiedGalleryManager,
  searchGalleryManagerCandidates, listMyManagedGalleries } from "../src/modules/gallery/galleryManagers.js"
import { canManage } from "../src/modules/member/member.routes.js"

const localDatabase = (() => {
  try { return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname) }
  catch { return false }
})()
test.after(async () => { await db.$client.end() })

test("a gallery can be managed by an account or a verified invited email", { skip: !localDatabase }, async () => {
  const app = Fastify()
  app.register(fastifyCookie)
  app.register(fastifyJwt, { secret: process.env.JWT_SECRET, cookie: { cookieName: "access_token", signed: false } })
  app.addHook("preHandler", authenticationMiddleware)
  app.get("/gallery/:galleryId/candidates", searchGalleryManagerCandidates)
  app.get("/gallery/:galleryId/managers", listUnifiedGalleryManagers)
  app.post("/gallery/:galleryId/managers", addUnifiedGalleryManager)
  app.delete("/gallery/:galleryId/managers/:type/:id", removeUnifiedGalleryManager)
  app.get("/mine", listMyManagedGalleries)
  await app.ready()
  const suffix = crypto.randomUUID()
  const [owner] = await db.insert(users).values({ email: `owner-${suffix}@example.invalid`, firstname: "Owner", lastname: "Test",
    role: "ADMIN", emailConfirmed: true }).returning()
  const [manager] = await db.insert(users).values({ email: `manager-${suffix}@example.invalid`, firstname: "Manager", lastname: "Test",
    role: "USER", emailConfirmed: true }).returning()
  const [gallery] = await db.insert(galleries).values({ name: `manager-${suffix}`, title: "Managed gallery",
    slug: `manager-${suffix}`, visibility: "PRIVATE", ownerUserId: owner.id }).returning()
  const [company] = await db.insert(companies).values({ name: `FindMe-${suffix}`, userId: manager.id }).returning()
  const [contact] = await db.insert(companyContacts).values({ companyId: company.id, firstname: "Other", lastname: "Contact",
    email: `contact-${suffix}@example.invalid` }).returning()
  const ownerCookie = `access_token=${app.jwt.sign({ id: owner.id, role: "ADMIN" })}`
  const managerCookie = `access_token=${app.jwt.sign({ id: manager.id, role: "USER" })}`
  try {
    const search = await app.inject({ method: "GET", url: `/gallery/${gallery.id}/candidates?q=${encodeURIComponent(manager.email)}`, headers: { cookie: ownerCookie } })
    assert.equal(search.statusCode, 200, search.body)
    assert.equal(search.json().data.some((item) => item.id === manager.id), true)
    const companySearch = await app.inject({ method: "GET", url: `/gallery/${gallery.id}/candidates?q=FindMe`, headers: { cookie: ownerCookie } })
    assert.equal(companySearch.json().data.some((item) => item.type === "USER" && item.id === manager.id), true)
    assert.equal(companySearch.json().data.some((item) => item.type === "CONTACT" && item.id === contact.id), true)
    const add = await app.inject({ method: "POST", url: `/gallery/${gallery.id}/managers`, headers: { cookie: ownerCookie },
      payload: { type: "USER", id: manager.id } })
    assert.equal(add.statusCode, 200, add.body)
    assert.equal(await canManage(manager.id, gallery.id), true)
    const listed = await app.inject({ method: "GET", url: `/gallery/${gallery.id}/managers`, headers: { cookie: ownerCookie } })
    const grant = listed.json().data.find((item) => item.email === manager.email)
    assert.equal(grant.status, "Actif")
    const remove = await app.inject({ method: "DELETE", url: `/gallery/${gallery.id}/managers/USER/${grant.id}`, headers: { cookie: ownerCookie } })
    assert.equal(remove.statusCode, 200, remove.body)
    assert.equal(await canManage(manager.id, gallery.id), false)
    await db.insert(galleryManagerInvitations).values({ galleryId: gallery.id, email: manager.email, invitedByUserId: owner.id })
    assert.equal(await canManage(manager.id, gallery.id), true)
    const mine = await app.inject({ method: "GET", url: "/mine", headers: { cookie: managerCookie } })
    assert.equal(mine.json().data.some((item) => item.id === gallery.id), true)
  } finally {
    await app.close()
    await db.delete(galleries).where(eq(galleries.id, gallery.id))
    await db.delete(companies).where(eq(companies.id, company.id))
    await db.delete(users).where(eq(users.id, manager.id))
    await db.delete(users).where(eq(users.id, owner.id))
  }
})
