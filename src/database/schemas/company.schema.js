import { pitaya } from "@db"
import { jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "../schema"

export const companies = pitaya.table("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  location: jsonb("location"),
  siret: text("siret"),
  vatNumber: text("vat_number"),
  userId: uuid("userId").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
