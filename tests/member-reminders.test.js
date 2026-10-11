import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import Fastify from "fastify"
import fastifyCookie from "@fastify/cookie"
import fastifyJwt from "@fastify/jwt"
import { eq } from "drizzle-orm"
import { db } from "../src/database/index.js"
import { companies, companyContacts, galleries, galleryUserManagerGrants, users } from "../src/database/schema.js"
import memberRoutes from "../src/modules/member/member.routes.js"

const localDatabase = (() => {
  try { return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname) }
  catch { return false }
})()
test.after(async () => { await db.$client.end() })

test("manager reminders only expose and accept contacts from the gallery company", { skip: !localDatabase }, async () => {
  const app = Fastify()
  app.register(fastifyCookie)
  app.register(fastifyJwt, { secret: process.env.JWT_SECRET, cookie: { cookieName: "access_token", signed: false } })
  app.register(memberRoutes, { prefix: "/member" })
  await app.ready()
  const suffix = crypto.randomUUID()
  const [owner, manager, outsider] = await db.insert(users).values([
    { email: `owner-${suffix}@example.invalid`, role: "ADMIN", emailConfirmed: true },
    { email: `manager-${suffix}@example.invalid`, role: "USER", emailConfirmed: true },
    { email: `outsider-${suffix}@example.invalid`, role: "USER", emailConfirmed: true },
  ]).returning({ id: users.id })
  const [company, otherCompany] = await db.insert(companies).values([
    { name: `Client-${suffix}`, userId: owner.id },
    { name: `Other-${suffix}`, userId: owner.id },
  ]).returning({ id: companies.id })
  const [contact, foreignContact] = await db.insert(companyContacts).values([
    { companyId: company.id, firstname: "Client", lastname: "Contact", email: `client-${suffix}@example.invalid` },
    { companyId: otherCompany.id, firstname: "Other", lastname: "Contact", email: `other-${suffix}@example.invalid` },
  ]).returning({ id: companyContacts.id })
  const [gallery] = await db.insert(galleries).values({ name: `manager-reminder-${suffix}`,
    title: "Manager reminder", slug: `manager-reminder-${suffix}`, visibility: "PRIVATE",
    ownerUserId: owner.id, clientCompanyId: company.id }).returning({ id: galleries.id })
  await db.insert(galleryUserManagerGrants).values({ galleryId: gallery.id, userId: manager.id })
  const cookie = (account) => `access_token=${app.jwt.sign({ id: account.id, role: "USER" })}`
  try {
    const path = `/member/galleries/${gallery.id}`
    assert.equal((await app.inject({ method: "GET", url: `${path}/reminder-contacts`, headers: { cookie: cookie(outsider) } })).statusCode, 403)
    const listed = await app.inject({ method: "GET", url: `${path}/reminder-contacts`, headers: { cookie: cookie(manager) } })
    assert.equal(listed.statusCode, 200, listed.body)
    assert.deepEqual(listed.json().data.contacts.map((item) => item.id), [contact.id])
    const forbidden = await app.inject({ method: "POST", url: `${path}/reminders`, headers: { cookie: cookie(manager) },
      payload: { value: 7, unit: "DAY", contactIds: [foreignContact.id] } })
    assert.equal(forbidden.statusCode, 400, forbidden.body)
    const created = await app.inject({ method: "POST", url: `${path}/reminders`, headers: { cookie: cookie(manager) },
      payload: { value: 7, unit: "DAY", contactIds: [contact.id] } })
    assert.equal(created.statusCode, 201, created.body)
    const reminders = await app.inject({ method: "GET", url: `${path}/reminders`, headers: { cookie: cookie(manager) } })
    assert.deepEqual(reminders.json().data[0].contactIds, [contact.id])
  } finally {
    await app.close()
    await db.delete(galleries).where(eq(galleries.id, gallery.id))
    await db.delete(companies).where(eq(companies.id, company.id))
    await db.delete(companies).where(eq(companies.id, otherCompany.id))
    await db.delete(users).where(eq(users.id, outsider.id))
    await db.delete(users).where(eq(users.id, manager.id))
    await db.delete(users).where(eq(users.id, owner.id))
  }
})
