"use server"

import { neon } from "@neondatabase/serverless"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

const sql = neon(process.env.DATABASE_URL!)

interface ParsedFirefighter {
  firstName: string
  lastName: string
  email?: string
  phone?: string
}

function parseFirefighterLine(line: string): ParsedFirefighter | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Split by comma
  const parts = trimmed.split(",").map((p) => p.trim())

  if (parts.length === 0) return null

  // First part should be the name
  const nameParts = parts[0].split(" ").filter((p) => p.length > 0)
  if (nameParts.length < 2) return null

  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(" ")

  // Try to find email and phone in remaining parts
  let email: string | undefined
  let phone: string | undefined

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (part.includes("@")) {
      email = part
    } else if (/[\d-()]+/.test(part)) {
      phone = part
    }
  }

  // Generate email if not provided
  if (!email) {
    const emailName = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, "")}`
    email = `${emailName}@pompiers.local`
  }

  return { firstName, lastName, email, phone }
}

export async function bulkImportFirefighters(
  firefightersData: string,
  teamId: number | null,
): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    const lines = firefightersData.split("\n")
    const firefighters: ParsedFirefighter[] = []

    for (const line of lines) {
      const parsed = parseFirefighterLine(line)
      if (parsed) {
        firefighters.push(parsed)
      }
    }

    if (firefighters.length === 0) {
      return {
        success: false,
        message: "Aucun pompier valide trouvé dans les données",
      }
    }

    let successCount = 0

    for (const firefighter of firefighters) {
      try {
        // Check if user already exists
        const existing = await sql`
          SELECT id FROM users WHERE email = ${firefighter.email}
        `

        if (existing.length > 0) {
          console.log(`[v0] User ${firefighter.email} already exists, skipping`)
          continue
        }

        // Insert user
        const result = await sql`
          INSERT INTO users (first_name, last_name, email, phone, role, is_admin, password_hash)
          VALUES (
            ${firefighter.firstName},
            ${firefighter.lastName},
            ${firefighter.email},
            ${firefighter.phone || null},
            'firefighter',
            false,
            'temp_password_hash'
          )
          RETURNING id
        `

        const userId = result[0].id

        // Add to team if specified
        if (teamId) {
          await sql`
            INSERT INTO team_members (user_id, team_id)
            VALUES (${userId}, ${teamId})
          `
        }

        successCount++
      } catch (error) {
        console.error(`[v0] Error importing firefighter ${firefighter.email}:`, error)
      }
    }

    try {
      revalidatePath("/dashboard/admin")
      revalidatePath("/dashboard/users")
    } catch (revalidateError) {
      console.log("[v0] Revalidation failed (non-critical):", revalidateError)
    }

    return {
      success: true,
      message: `Importation réussie`,
      count: successCount,
    }
  } catch (error) {
    console.error("[v0] Bulk import error:", error)
    return {
      success: false,
      message: "Erreur lors de l'importation des pompiers",
    }
  }
}

export async function importTeam1Firefighters(): Promise<{
  success: boolean
  message: string
  imported: number
  skipped: number
}> {
  try {
    const team1Firefighters = [
      "Yan Fournier",
      "Michel Ruel",
      "Marc-André Dubois",
      "Patrick Bourassa",
      "Simon Poisson-Carignan",
      "Francis Allard",
      "Raphael Cloutier",
      "Alexandre Pouliot",
    ]

    // Ensure Team 1 exists
    const team = await sql`SELECT id FROM teams WHERE name = 'Équipe Permanente 1'`
    let teamId: number

    if (team.length === 0) {
      const newTeam = await sql`
        INSERT INTO teams (name, type, color, capacity)
        VALUES ('Équipe Permanente 1', 'permanent', '#3B82F6', 8)
        RETURNING id
      `
      teamId = newTeam[0].id
    } else {
      teamId = team[0].id
    }

    // Hash the default password once
    const defaultPassword = "Pompier2025!"
    const passwordHash = await bcrypt.hash(defaultPassword, 10)

    let imported = 0
    let skipped = 0

    for (const fullName of team1Firefighters) {
      const nameParts = fullName.split(" ")
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(" ")
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}@victoriaville.ca`

      // Check if user already exists
      const existing = await sql`SELECT id FROM users WHERE email = ${email}`

      if (existing.length > 0) {
        console.log(`[v0] User ${email} already exists, skipping`)
        skipped++
        continue
      }

      // Insert user
      const result = await sql`
        INSERT INTO users (first_name, last_name, email, role, is_admin, password_hash)
        VALUES (${firstName}, ${lastName}, ${email}, 'firefighter', false, ${passwordHash})
        RETURNING id
      `

      const userId = result[0].id

      // Add to team
      await sql`
        INSERT INTO team_members (user_id, team_id)
        VALUES (${userId}, ${teamId})
        ON CONFLICT DO NOTHING
      `

      imported++
      console.log(`[v0] Imported ${fullName} (${email})`)
    }

    try {
      revalidatePath("/dashboard/firefighters")
      revalidatePath("/dashboard/teams")
    } catch (revalidateError) {
      console.log("[v0] Revalidation failed (non-critical):", revalidateError)
    }

    return {
      success: true,
      message: `Importation terminée: ${imported} pompiers ajoutés, ${skipped} déjà existants`,
      imported,
      skipped,
    }
  } catch (error) {
    console.error("[v0] Error importing Team 1:", error)
    return {
      success: false,
      message: `Erreur lors de l'importation: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      imported: 0,
      skipped: 0,
    }
  }
}

export async function addFirefighter(data: {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  role: string
  teamId: number | null
}): Promise<{ success: boolean; message: string }> {
  try {
    // Check if user already exists
    const existing = await sql`SELECT id FROM users WHERE email = ${data.email}`

    if (existing.length > 0) {
      return {
        success: false,
        message: "Un pompier avec cet email existe déjà",
      }
    }

    // Hash the default password
    const defaultPassword = "Pompier2025!"
    const passwordHash = await bcrypt.hash(defaultPassword, 10)

    // Insert user
    const result = await sql`
      INSERT INTO users (first_name, last_name, email, phone, role, is_admin, password_hash)
      VALUES (
        ${data.firstName},
        ${data.lastName},
        ${data.email},
        ${data.phone},
        ${data.role},
        false,
        ${passwordHash}
      )
      RETURNING id
    `

    const userId = result[0].id

    // Add to team if specified
    if (data.teamId) {
      await sql`
        INSERT INTO team_members (user_id, team_id)
        VALUES (${userId}, ${data.teamId})
        ON CONFLICT DO NOTHING
      `
    }

    try {
      revalidatePath("/dashboard/firefighters")
      revalidatePath("/dashboard/teams")
    } catch (revalidateError) {
      console.log("[v0] Revalidation failed (non-critical):", revalidateError)
    }

    return {
      success: true,
      message: "Pompier ajouté avec succès",
    }
  } catch (error) {
    console.error("[v0] Error adding firefighter:", error)
    return {
      success: false,
      message: "Erreur lors de l'ajout du pompier",
    }
  }
}
