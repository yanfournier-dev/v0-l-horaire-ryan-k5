import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

async function checkTeams() {
  console.log("[v0] Checking teams in database...")

  const teams = await sql`
    SELECT id, name, type, capacity, color, created_at
    FROM teams
    ORDER BY id
  `

  console.log("[v0] Found", teams.length, "teams:")
  console.log("[v0] Teams:", JSON.stringify(teams, null, 2))

  // Check specifically for Pompiers Réguliers
  const pompiersReguliers = teams.find((t: any) => t.name === "Pompiers Réguliers")

  if (pompiersReguliers) {
    console.log("[v0] ✓ Pompiers Réguliers team found!")
    console.log("[v0] Details:", pompiersReguliers)
  } else {
    console.log("[v0] ✗ Pompiers Réguliers team NOT found in database")
    console.log("[v0] This means the SQL script has not been executed yet")
  }
}

checkTeams().catch(console.error)
