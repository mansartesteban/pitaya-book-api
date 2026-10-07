import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "../src/database/index.js"
import { users } from "../src/database/schema.js"
import { adminMiddleware } from "../src/lib/middlewares/authentication.js"

const localDatabase = (() => {
  try { return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname) }
  catch { return false }
})()

test.after(async () => { await db.$client.end() })

test("a regular signed-in account cannot access administration routes", { skip: !localDatabase }, async () => {
  const [account] = await db.insert(users).values({ email: `test-${crypto.randomUUID()}@example.invalid`,
    role: "USER", emailConfirmed: true }).returning({ id: users.id })
  try {
    const response = { status: null, body: null, code(status) { this.status = status; return this },
      send(body) { this.body = body; return this } }
    await adminMiddleware({ user: { id: account.id } }, response)
    assert.equal(response.status, 403)
    assert.equal(response.body.error, "Accès réservé à l'administration")
  } finally {
    await db.delete(users).where(eq(users.id, account.id))
  }
})
