import { text, timestamp, uuid } from "drizzle-orm/pg-core"
import { pitaya } from "../index.js"
import { galleries } from "./gallery.schema.js"
import { photos } from "./photo.schema.js"
import { users } from "../../modules/user/user.schema.js"

export const galleryInteractions = pitaya.table("gallery_interactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  galleryId: uuid("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  photoId: uuid("photo_id").references(() => photos.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  guestEmail: text("guest_email"),
  guestName: text("guest_name"),
  kind: text("kind").notNull(),
  content: text("content"),
  reaction: text("reaction"),
  parentCommentId: uuid("parent_comment_id"),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  status: text("status").default("PENDING").notNull(),
  verificationTokenHash: text("verification_token_hash"),
  verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
})
