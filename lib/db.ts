import { neon, neonConfig } from "@neondatabase/serverless"

neonConfig.disableWarningInBrowsers = true

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!connectionString) {
  throw new Error("No database connection string found. Please set DATABASE_URL or POSTGRES_URL environment variable.")
}

export const sql = neon(connectionString)
