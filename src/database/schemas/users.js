import { boolean, timestamp, text, serial } from "drizzle-orm/pg-core"

import { pitaya } from "../schema.js"

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
  id: serial("id").primaryKey(), // Int auto-increment
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),

  firstname: text("firstname").default(""),
  lastname: text("lastname").default(""),
  email: text("email").notNull().unique(),
  phone: text("phone").default(""),

  emailConfirmed: boolean("email_confirmed").default(false),

  role: roles("role").default("USER"),
  clientType: clientType("client_type").default("INDIVIDUAL"),
  companyName: text("company_name").$type(),

  // Auth
  password: text("password").$type(),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at").$type(),

  // Meta
  notes: text("notes").$type(),
})
