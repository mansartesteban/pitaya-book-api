import { defineConfig } from "drizzle-kit"
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schema.js",
  out: "./src/database/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
})
