import { boolean, integer, pgEnum, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { photos, users } from "../schema.js"
import { companies } from "./company.schema.js"
import { services } from "../../modules/service/service.schema.js"
import { pitaya } from "../index.js"

export const galleryVisibility = pitaya.enum("gallery_visibility", [
  "HIDDEN",
  "PRIVATE",
  "UNLISTED",
  "PUBLIC",
])

export const galleries = pitaya.table("galleries", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  visibility: galleryVisibility("visibility").notNull(),
  downloadable: boolean("downloadable").default(false).notNull(),
  allowReactions: boolean("allow_reactions").default(true).notNull(),
  allowComments: boolean("allow_comments").default(true).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  expirationApplied: boolean("expiration_applied").default(false).notNull(),
  reminderDays: integer("reminder_days").default(7).notNull(),
  reminderValue: integer("reminder_value").default(7).notNull(),
  reminderUnit: text("reminder_unit").default("DAY").notNull(),
  clientCompanyId: uuid("client_company_id").references(() => companies.id, { onDelete: "set null" }),

  coverPhotoId: uuid("cover_photo_id").references(() => photos.id, {
    onDelete: "set null",
  }),
  coverPositionX: integer("cover_position_x").default(50).notNull(),
  coverPositionY: integer("cover_position_y").default(50).notNull(),
  coverZoom: integer("cover_zoom").default(100).notNull(),
  coverContain: boolean("cover_contain").default(false).notNull(),

  password: text("password"),

  parentGallery: uuid("parent_gallery_id").references(() => galleries.id, {
    onDelete: "set null",
  }),
  ownerUserId: uuid("owner_user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  ownerCompanyId: uuid("owner_company_id").references(() => companies.id, {
    onDelete: "cascade",
  }),

  serviceId: integer("service_id").references(() => services.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
})
