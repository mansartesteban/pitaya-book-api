import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import Fastify from "fastify"
import fastifyCookie from "@fastify/cookie"
import fastifyJwt from "@fastify/jwt"
import { eq } from "drizzle-orm"
import { db } from "../src/database/index.js"
import { users, companies, companyContacts } from "../src/database/schema.js"
import clientRoutes from "../src/modules/clients/client.routes.js"
import userRoutes from "../src/modules/user/user.routes.js"

const localDatabase = (() => {
  try { return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname) }
  catch { return false }
})()

test.after(async () => { await db.$client.end() })

test("individual client can be listed, edited, and removed by its admin", { skip: !localDatabase }, async () => {
  const app = Fastify()
  app.register(fastifyCookie)
  app.register(fastifyJwt, { secret: process.env.JWT_SECRET, cookie: { cookieName: "access_token", signed: false } })
  app.register(clientRoutes, { prefix: "/api/clients" })
  app.register(userRoutes, { prefix: "/api/users" })
  const [admin] = await db.insert(users).values({ email: `admin-${crypto.randomUUID()}@example.invalid`,
    firstname: "Test", lastname: "Admin", role: "ADMIN", emailConfirmed: true }).returning({ id: users.id })
  let clientId
  try {
    await app.ready()
    const cookie = `access_token=${app.jwt.sign({ id: admin.id, role: "ADMIN" })}`
    const matchedAccount = await app.inject({ method: "GET", url: `/api/users/by-email?email=${encodeURIComponent((await db.select({ email: users.email }).from(users).where(eq(users.id, admin.id)))[0].email)}`, headers: { cookie } })
    assert.equal(matchedAccount.statusCode, 200, matchedAccount.body)
    assert.equal(matchedAccount.json().data.firstname, "Test")
    const created = await app.inject({ method: "POST", url: "/api/clients/individuals", headers: { cookie },
      payload: { firstname: "Alice", lastname: "Martin", email: "Alice@example.invalid" } })
    assert.equal(created.statusCode, 201, created.body)
    clientId = created.json().data.id
    const listed = await app.inject({ method: "GET", url: "/api/clients/individuals", headers: { cookie } })
    assert.equal(listed.statusCode, 200, listed.body)
    assert.equal(listed.json().data.find((item) => item.id === clientId)?.email, "alice@example.invalid")
    const all = await app.inject({ method: "GET", url: "/api/clients/all", headers: { cookie } })
    assert.equal(all.json().data.find((item) => item.id === clientId)?.kind, "INDIVIDUAL")
    const updated = await app.inject({ method: "PUT", url: `/api/clients/individuals/${clientId}`, headers: { cookie },
      payload: { firstname: "Alice", lastname: "Durand", email: "alice@example.invalid" } })
    assert.equal(updated.statusCode, 200, updated.body)
    const [stored] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, clientId))
    assert.equal(stored.name, "Alice Durand")
    const removed = await app.inject({ method: "DELETE", url: `/api/clients/individuals/${clientId}`, headers: { cookie } })
    assert.equal(removed.statusCode, 200, removed.body)
    clientId = null
  } finally {
    if (clientId) {
      await db.delete(companyContacts).where(eq(companyContacts.companyId, clientId))
      await db.delete(companies).where(eq(companies.id, clientId))
    }
    await db.delete(users).where(eq(users.id, admin.id))
    await app.close()
  }
})
