import { timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { pitaya } from "../index.js"
import { galleries } from "./gallery.schema.js"
import { users } from "../../modules/user/user.schema.js"

export const galleryUserManagerGrants = pitaya.table("gallery_user_manager_grants", {
  id: uuid("id").defaultRandom().primaryKey(),
  galleryId: uuid("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  grantedByUserId: uuid("granted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqueUserGallery: unique().on(t.galleryId, t.userId) }))
