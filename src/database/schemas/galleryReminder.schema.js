import { integer, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { pitaya } from "../index.js"
import { companyContacts } from "./companyContact.schema.js"
import { galleries } from "./gallery.schema.js"
import { users } from "../../modules/user/user.schema.js"

export const galleryReminderContacts = pitaya.table("gallery_reminder_contacts", {
  galleryId: uuid("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => companyContacts.id, { onDelete: "cascade" }),
}, (t) => ({ uniqueContact: unique().on(t.galleryId, t.contactId) }))

export const galleryReminders = pitaya.table("gallery_reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  galleryId: uuid("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  value: integer("value").notNull(),
  unit: text("unit").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const galleryReminderRecipients = pitaya.table("gallery_reminder_recipients", {
  reminderId: uuid("reminder_id").notNull().references(() => galleryReminders.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => companyContacts.id, { onDelete: "cascade" }),
}, (t) => ({ uniqueRecipient: unique().on(t.reminderId, t.contactId) }))

export const adminNotifications = pitaya.table("admin_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  galleryId: uuid("gallery_id").references(() => galleries.id, { onDelete: "cascade" }),
  photoId: uuid("photo_id"),
  commentId: uuid("comment_id"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  eventKey: text("event_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
}, (t) => ({ uniqueEvent: unique().on(t.ownerUserId, t.eventKey) }))

export const galleryReminderDeliveries = pitaya.table("gallery_reminder_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  galleryId: uuid("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => companyContacts.id, { onDelete: "cascade" }),
  eventKey: text("event_key").notNull(),
  status: text("status").notNull(),
  attemptCount: integer("attempt_count").default(0).notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  lastError: text("last_error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (t) => ({ uniqueDelivery: unique().on(t.contactId, t.eventKey) }))
