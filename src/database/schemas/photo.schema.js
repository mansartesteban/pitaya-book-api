import {
  integer,
  numeric,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"
import { galleries, users } from "../schema"
import { pitaya } from "@db"

export const photos = pitaya.table("photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  galleryId: uuid("gallery_id")
    .references(() => galleries.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name"),
  filename: text("filename"),
  extension: text("extension").notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull(), // En bytes
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  ratio: numeric("ratio", { precision: 3 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const photoComments = pitaya.table("photo_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  photoId: uuid("photo_id")
    .references(() => photos.id)
    .notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const photoReactions = pitaya.table(
  "photo_reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    photoId: uuid("photo_id")
      .references(() => photos.id)
      .notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reaction: text("reaction").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqReaction: unique().on(t.photoId, t.userId, t.reaction),
  })
)
