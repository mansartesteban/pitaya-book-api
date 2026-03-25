import { timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { users } from "../schema.js"
import { companies } from "./company.schema.js"
import { pitaya } from "../index.js"

export const companyMemberRole = pitaya.enum("company_member_role", [
  "ADMIN",
  "MEMBER",
])

export const companyMemberStatus = pitaya.enum("company_member_status", [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
])

export const companyMembers = pitaya.table(
  "company_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id, {
        onDelete: "cascade",
      })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, {
        onDelete: "cascade",
      })
      .notNull(),
    role: companyMemberRole("role").notNull(),
    status: companyMemberStatus("status").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqMember: unique().on(t.companyId, t.userId),
  })
)
