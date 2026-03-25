import { integer, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { services } from "../../modules/service/service.schema.js"
import { pitaya } from "../index.js"

export const documentCategoryEnum = pitaya.enum("document_category", [
  "SERVICE",
  "OTHER",
])

export const documents = pitaya.table("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceId: integer("service_id")
    .references(() => services.id, { onDelete: "cascade" })
    .notNull(),

  filename: text("filename").notNull(), // Nom original
  storedName: text("stored_name").notNull(), // Nom sur le disque (unique)
  mimetype: text("mimetype").notNull(),
  size: integer("size").notNull(), // En bytes
  extension: text("extension").notNull(),

  category: documentCategoryEnum("category"),
  folder: text("folder"),
  path: text("path").notNull(),

  url: text("url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
})
