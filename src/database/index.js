import dotenv from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import { pgSchema } from "drizzle-orm/pg-core"

dotenv.config()

// You can specify any property from the postgres-js connection options
const db = drizzle({
  connection: {
    url: process.env.DATABASE_URL,
    // ssl: true,
  },
})

const pitaya = pgSchema("pitaya")

export { db, pitaya }
