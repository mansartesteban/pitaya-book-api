import { boolean, timestamp, text, uuid } from "drizzle-orm/pg-core"

import { pitaya } from "../../database/index.js"

// Enums
export const clientType = pitaya.enum("client_type", [
  "INDIVIDUAL",
  "PROFESSIONAL",
  "ASSOCIATION",
  "OTHER",
])

export const roles = pitaya.enum("roles", [
  "USER",
  "GUEST",
  "CLIENT",
  "ADMIN",
  "SUPERADMIN",
])

// Table User
export const users = pitaya.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),

  firstname: text("firstname").default(""),
  lastname: text("lastname").default(""),
  email: text("email").notNull().unique(),
  emailConfirmed: boolean("email_confirmed").default(false),
  phone: text("phone").default(""),
  role: roles("role").default("USER"),

  // Auth
  password: text("password").$type(),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at").$type(),

  // Meta
  notes: text("notes").$type(),
})
