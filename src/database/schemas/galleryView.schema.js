import { timestamp, uuid, text, index } from "drizzle-orm/pg-core"
import { pitaya } from "../index.js"
import { galleries } from "./gallery.schema.js"
import { photos } from "./photo.schema.js"
import { users } from "../../modules/user/user.schema.js"

export const galleryViewEvents = pitaya.table("gallery_view_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  galleryId: uuid("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  photoId: uuid("photo_id").references(() => photos.id, { onDelete: "cascade" }),
  visitorHash: text("visitor_hash").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ galleryDateIndex: index("gallery_view_events_gallery_date_idx").on(t.galleryId, t.createdAt) }))
