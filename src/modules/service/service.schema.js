import {
  integer,
  jsonb,
  pgEnum,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { users } from "../user/user.schema"
import { companies } from "../../database/schemas/company.schema"
import { pitaya } from "@db"

export const ServiceStatusEnum = {
  LEAD: "LEAD", // Demande reçue
  QUOTE_SENT: "QUOTE_SENT", // Devis envoyé
  QUOTE_ACCEPTED: "QUOTE_ACCEPTED", // Devis accepté
  SCHEDULED: "SCHEDULED", // Prestation planifiée
  DONE: "DONE", // Prestation réalisée
  POST_PROD: "POST_PROD", // Post-prod en cours
  DELIVERED: "DELIVERED", // Livraison effectuée
  COMPLETED: "COMPLETED", // Projet terminé
  DELAYED: "DELAYED", // Projet reporté
  CANCELLED: "CANCELLED", // Projet annulé
}

export const statusEnum = pitaya.enum(
  "service_status",
  Object.values(ServiceStatusEnum)
)

export const services = pitaya.table("services", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  location: jsonb("location"), // Emplacement
  status: statusEnum("status").notNull(),
  price: integer("price"),
  description: text("description"),

  clientUserId: uuid("client_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  clientCompanyId: uuid("client_company_id").references(() => companies.id, {
    onDelete: "set null",
  }),

  providerUserId: uuid("provider_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
