import { text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { pitaya } from "../index.js"
import { galleries } from "./gallery.schema.js"
import { companyContacts } from "./companyContact.schema.js"
import { users } from "../../modules/user/user.schema.js"

export const galleryManagerInvitations = pitaya.table("gallery_manager_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  galleryId: uuid("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  firstname: text("firstname"),
  lastname: text("lastname"),
  contactId: uuid("contact_id").references(() => companyContacts.id, { onDelete: "set null" }),
  invitedByUserId: uuid("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqueEmailGallery: unique().on(t.galleryId, t.email) }))
