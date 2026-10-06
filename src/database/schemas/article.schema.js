import { boolean, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { pitaya } from "../index.js"

export const articles = pitaya.table("articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: jsonb("content").notNull(),
  isDraft: boolean("is_draft").notNull().default(true),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
