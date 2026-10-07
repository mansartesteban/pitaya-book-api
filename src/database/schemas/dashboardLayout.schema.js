import { jsonb, timestamp, uuid } from "drizzle-orm/pg-core"
import { pitaya } from "../index.js"
import { users } from "../../modules/user/user.schema.js"

export const dashboardLayouts = pitaya.table("dashboard_layouts", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  layout: jsonb("layout").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})
