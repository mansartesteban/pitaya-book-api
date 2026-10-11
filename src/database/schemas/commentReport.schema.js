import { text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { pitaya } from "../index.js"
import { galleryInteractions } from "./galleryInteraction.schema.js"
import { users } from "../../modules/user/user.schema.js"

export const commentReports = pitaya.table("comment_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  commentId: uuid("comment_id").notNull().references(() => galleryInteractions.id, { onDelete: "cascade" }),
  reporterUserId: uuid("reporter_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").default("PENDING").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
}, (t) => ({ uniqueReporter: unique().on(t.commentId, t.reporterUserId) }))
