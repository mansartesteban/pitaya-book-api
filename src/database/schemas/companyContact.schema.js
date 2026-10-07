import { boolean, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { pitaya } from "../index.js"
import { companies } from "./company.schema.js"

export const companyContacts = pitaya.table("company_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  firstname: text("firstname").notNull(),
  lastname: text("lastname").notNull(),
  email: text("email"),
  phone: text("phone"),
  reminderToken: uuid("reminder_token").defaultRandom().notNull().unique(),
  remindersEnabled: boolean("reminders_enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})
