import { pitaya } from "../index.js"
import { uuid, varchar, timestamp, boolean } from "drizzle-orm/pg-core"
import { users } from "../schema.js"

export const emailTokens = pitaya.table("email_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  type: varchar("type", { length: 32 }).notNull(), // "email_verification" | "password_reset"
  token: varchar("token", { length: 1024 }).notNull().unique(),
  used: boolean("used").default(false),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})
