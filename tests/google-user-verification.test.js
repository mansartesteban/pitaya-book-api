import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "../src/database/index.js"
import { users } from "../src/database/schema.js"
import { findOrCreateGoogleUser } from "../src/modules/auth/auth.service.js"

const localDatabase = (() => {
  try { return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname) }
  catch { return false }
})()

test.after(async () => { await db.$client.end() })

test("Google login keeps the site's email verification separate", { skip: !localDatabase }, async () => {
  const email = `google-${crypto.randomUUID()}@example.invalid`
  try {
    const first = await findOrCreateGoogleUser({ email, given_name: "Test", family_name: "Google" })
    assert.equal(first.created, true)
    assert.equal(first.user.emailConfirmed, false)

    const second = await findOrCreateGoogleUser({ email, given_name: "Test", family_name: "Google" })
    assert.equal(second.created, false)
    assert.equal(second.user.emailConfirmed, false)

    await db.update(users).set({ emailConfirmed: true }).where(eq(users.email, email))
    const verified = await findOrCreateGoogleUser({ email, given_name: "Test", family_name: "Google" })
    assert.equal(verified.created, false)
    assert.equal(verified.user.emailConfirmed, true)
  } finally {
    await db.delete(users).where(eq(users.email, email))
  }
})
