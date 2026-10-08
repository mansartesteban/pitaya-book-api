import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "../src/database/index.js"
import { adminNotifications, galleries, users } from "../src/database/schema.js"
import { notifyPublicGalleryPublished } from "../src/modules/notifications/galleryPublication.js"

const localDatabase = (() => {
  try { return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname) }
  catch { return false }
})()

test.after(async () => { await db.$client.end() })

test("public gallery alerts only verified users who enabled them", { skip: !localDatabase }, async () => {
  const email = (suffix) => `publication-${suffix}-${crypto.randomUUID()}@example.invalid`
  const [owner, enabled, disabled, unverified] = await db.insert(users).values([
    { email: email("owner"), firstname: "Owner", lastname: "Test", role: "ADMIN", emailConfirmed: true },
    { email: email("enabled"), firstname: "Enabled", lastname: "Test", role: "USER", emailConfirmed: true },
    { email: email("disabled"), firstname: "Disabled", lastname: "Test", role: "USER", emailConfirmed: true,
      publicGalleryNotificationsEnabled: false },
    { email: email("unverified"), firstname: "Unverified", lastname: "Test", role: "USER", emailConfirmed: false },
  ]).returning({ id: users.id })
  let galleryId
  try {
    const [gallery] = await db.insert(galleries).values({ name: "publication-test", title: "Publication test",
      slug: `publication-${crypto.randomUUID()}`, visibility: "PUBLIC", ownerUserId: owner.id }).returning({ id: galleries.id })
    galleryId = gallery.id
    await notifyPublicGalleryPublished(galleryId)
    const alerts = await db.select({ ownerUserId: adminNotifications.ownerUserId })
      .from(adminNotifications).where(eq(adminNotifications.galleryId, galleryId))
    const createdUserIds = new Set([owner.id, enabled.id, disabled.id, unverified.id])
    assert.deepEqual(alerts.map((item) => item.ownerUserId).filter((id) => createdUserIds.has(id)), [enabled.id])
  } finally {
    if (galleryId) await db.delete(galleries).where(eq(galleries.id, galleryId))
    for (const account of [owner, enabled, disabled, unverified]) {
      await db.delete(users).where(eq(users.id, account.id))
    }
  }
})
