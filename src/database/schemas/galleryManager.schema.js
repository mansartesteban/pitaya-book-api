import { timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { pitaya } from "../index.js"
import { galleries } from "./gallery.schema.js"
import { companyContacts } from "./companyContact.schema.js"
import { users } from "../../modules/user/user.schema.js"

export const galleryManagerGrants = pitaya.table("gallery_manager_grants", {
  id: uuid("id").defaultRandom().primaryKey(),
  galleryId: uuid("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => companyContacts.id, { onDelete: "cascade" }),
  grantedByUserId: uuid("granted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqueContactGallery: unique().on(t.galleryId, t.contactId) }))
