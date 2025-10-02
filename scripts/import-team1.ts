import { neon } from "@neondatabase/serverless"
import bcrypt from "bcryptjs"

const sql = neon(process.env.DATABASE_URL!)

async function importTeam1() {
  console.log("[v0] Starting Team 1 import...")

  // Team 1 firefighters
  const firefighters = [
    { firstName: "Yan", lastName: "Fournier" },
    { firstName: "Michel", lastName: "Ruel" },
    { firstName: "Marc-André", lastName: "Dubois" },
    { firstName: "Patrick", lastName: "Bourassa" },
    { firstName: "Simon", lastName: "Poisson-Carignan" },
    { firstName: "Francis", lastName: "Allard" },
    { firstName: "Raphael", lastName: "Cloutier" },
    { firstName: "Alexandre", lastName: "Pouliot" },
  ]

  try {
    // Check if Team 1 exists, if not create it
    console.log("[v0] Checking if Team 1 exists...")
    const teamResult = await sql`
      INSERT INTO teams (name, color)
      VALUES ('Équipe 1', '#3b82f6')
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `
    const teamId = teamResult[0].id
    console.log(`[v0] Team 1 ID: ${teamId}`)

    // Default password for all firefighters (they should change it)
    const defaultPassword = "Pompier2025!"
    const passwordHash = await bcrypt.hash(defaultPassword, 10)
    console.log("[v0] Generated password hash")

    let successCount = 0
    let skipCount = 0

    // Insert each firefighter
    for (const firefighter of firefighters) {
      const email = `${firefighter.firstName.toLowerCase().replace(/[éèê]/g, "e").replace(/[àâ]/g, "a")}.${firefighter.lastName.toLowerCase().replace(/[éèê]/g, "e").replace(/[àâ]/g, "a").replace(/-/g, "")}@pompiers.ca`

      console.log(`[v0] Processing ${firefighter.firstName} ${firefighter.lastName}...`)

      try {
        // Insert user
        const userResult = await sql`
          INSERT INTO users (first_name, last_name, email, phone, password_hash, role, is_admin)
          VALUES (
            ${firefighter.firstName},
            ${firefighter.lastName},
            ${email},
            '',
            ${passwordHash},
            'firefighter',
            false
          )
          ON CONFLICT (email) DO NOTHING
          RETURNING id
        `

        if (userResult.length > 0) {
          const userId = userResult[0].id

          // Assign to team
          await sql`
            INSERT INTO team_members (team_id, user_id)
            VALUES (${teamId}, ${userId})
            ON CONFLICT (team_id, user_id) DO NOTHING
          `

          console.log(`[v0] ✓ Added ${firefighter.firstName} ${firefighter.lastName} (${email})`)
          successCount++
        } else {
          console.log(`[v0] ⊘ Skipped ${firefighter.firstName} ${firefighter.lastName} (already exists)`)
          skipCount++
        }
      } catch (error) {
        console.error(`[v0] ✗ Error adding ${firefighter.firstName} ${firefighter.lastName}:`, error)
      }
    }

    console.log(`[v0] Import complete!`)
    console.log(`[v0] Successfully added: ${successCount}`)
    console.log(`[v0] Skipped (already exist): ${skipCount}`)
    console.log(`[v0] Default password for all: ${defaultPassword}`)
    console.log(`[v0] Users should change their password after first login`)
  } catch (error) {
    console.error("[v0] Import failed:", error)
    throw error
  }
}

importTeam1()
