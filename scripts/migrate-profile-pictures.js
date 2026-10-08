import { db } from "../src/database/index.js"
import { users } from "../src/database/schema.js"
import { and, eq, like } from "drizzle-orm"
import sharp from "sharp"
import { avatarPath, avatarUrl, removeAvatar, uploadAvatar } from "../src/modules/account/avatarStorage.js"

const rows = await db.select({ id: users.id, avatar: users.avatar })
  .from(users).where(like(users.avatar, "data:image/%"))

let migrated = 0
for (const row of rows) {
  const match = row.avatar.match(/^data:image\/(?:jpeg|png|webp);base64,(.+)$/s)
  if (!match) {
    process.stderr.write(`Unsupported avatar format for ${row.id}\n`)
    continue
  }
  const image = await sharp(Buffer.from(match[1], "base64"))
    .rotate().resize(256, 256, { fit: "cover" }).webp({ quality: 78 }).toBuffer()
  const path = avatarPath(row.id)
  await uploadAvatar(path, image)
  const result = await db.update(users).set({ avatar: avatarUrl(path) })
    .where(and(eq(users.id, row.id), eq(users.avatar, row.avatar))).returning({ id: users.id })
  if (result.length) migrated++
  else await removeAvatar(path)
}
process.stdout.write(`Migrated ${migrated}/${rows.length} profile pictures\n`)
await db.$client.end()
