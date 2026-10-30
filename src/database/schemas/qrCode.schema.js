import { boolean, index, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { pitaya } from "../index.js"

export const qrCodes = pitaya.table("qr_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  destination: text("destination").notNull(),
  category: text("category").notNull().default(""),
  tags: text("tags").notNull().default(""),
  location: text("location").notNull().default(""),
  note: text("note").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
export const qrOpenings = pitaya.table("qr_openings", {
  id: uuid("id").defaultRandom().primaryKey(),
  qrId: uuid("qr_id").notNull().references(() => qrCodes.id),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("qr_openings_code_date_idx").on(table.qrId, table.openedAt)])
