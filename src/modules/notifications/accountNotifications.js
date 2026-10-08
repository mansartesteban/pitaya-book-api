import { eq, inArray, or } from "drizzle-orm"
import { db } from "../../database/index.js"
import { adminNotifications, users } from "../../database/schema.js"

export async function notifyAdminsOfNewUser(account) {
  const admins = await db.select({ id: users.id }).from(users)
    .where(or(inArray(users.role, ["ADMIN", "SUPERADMIN"]), eq(users.email, "esteban.mansart@gmail.com")))
  if (!admins.length) return
  const name = [account.firstname, account.lastname].filter(Boolean).join(" ").trim() || account.email
  await db.insert(adminNotifications).values(admins.map(({ id }) => ({
    ownerUserId: id,
    kind: "USER_REGISTERED",
    title: "Nouvel utilisateur inscrit",
    body: `${name} a créé un compte.`,
    eventKey: `user-registered:${account.id}`,
  }))).onConflictDoNothing()
}
