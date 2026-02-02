import { Client } from "pg"

const client = new Client({
  user: "pitaya",
  host: "localhost",
  password: "azerty",
  port: 5432,
  database: "postgres",
})

async function createDB() {
  await client.connect()
  await client.query(`CREATE DATABASE pitaya;`)
  await client.end()
  console.info("Database created!")
}

createDB().catch(console.error)
