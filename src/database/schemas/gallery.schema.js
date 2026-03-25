import { integer, pgEnum, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "../schema.js"
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
  title: text("title").notNull(),
  description: text("description"),
  visibility: galleryVisibility("visibility").notNull(),

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
})
