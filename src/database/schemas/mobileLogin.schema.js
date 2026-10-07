import { pitaya } from "../index.js"
import { uuid, varchar, timestamp } from "drizzle-orm/pg-core"
import { users } from "../../modules/user/user.schema.js"

export const mobileLoginCodes = pitaya.table("mobile_login_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: varchar("code_hash", { length: 64 }).notNull().unique(),
  challenge: varchar("challenge", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
})
