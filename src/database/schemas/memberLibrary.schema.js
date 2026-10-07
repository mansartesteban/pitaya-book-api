import { timestamp, text, unique, uuid } from "drizzle-orm/pg-core"
import { pitaya } from "../index.js"
import { users } from "../../modules/user/user.schema.js"
import { galleries } from "./gallery.schema.js"
import { photos } from "./photo.schema.js"

export const favoriteGalleries = pitaya.table("favorite_galleries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  galleryId: uuid("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqueFavorite: unique().on(t.userId, t.galleryId) }))

export const favoritePhotos = pitaya.table("favorite_photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  photoId: uuid("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqueFavorite: unique().on(t.userId, t.photoId) }))

export const photoSelections = pitaya.table("photo_selections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const photoSelectionItems = pitaya.table("photo_selection_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  selectionId: uuid("selection_id").notNull().references(() => photoSelections.id, { onDelete: "cascade" }),
  photoId: uuid("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqueItem: unique().on(t.selectionId, t.photoId) }))
