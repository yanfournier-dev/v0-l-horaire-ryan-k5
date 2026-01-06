"use server"

import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import { hashPassword, getSession } from "@/app/actions/auth"
import { sql } from "@/lib/db"
import { createAuditLog } from "./audit"

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
        console.error(`Error importing firefighter ${firefighter.email}:`, error)
      }
    }

    try {
      revalidatePath("/dashboard/admin")
      revalidatePath("/dashboard/users")
    } catch (revalidateError) {
      console.log("Revalidation failed (non-critical):", revalidateError)
    }

    return {
      success: true,
      message: `Importation réussie`,
      count: successCount,
    }
  } catch (error) {
    console.error("Bulk import error:", error)
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

    const defaultPassword = "Pompier2025!"
    const passwordHash = await hashPassword(defaultPassword)

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
    }

    try {
      revalidatePath("/dashboard/firefighters")
      revalidatePath("/dashboard/teams")
    } catch (revalidateError) {
      console.log("Revalidation failed (non-critical):", revalidateError)
    }

    return {
      success: true,
      message: `Importation terminée: ${imported} pompiers ajoutés, ${skipped} déjà existants`,
      imported,
      skipped,
    }
  } catch (error) {
    console.error("Error importing Team 1:", error)
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

    const defaultPassword = "Pompier2025!"
    const passwordHash = await hashPassword(defaultPassword)

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

    const currentUser = await getSession()
    if (currentUser) {
      await createAuditLog({
        userId: currentUser.id,
        actionType: "USER_CREATED",
        tableName: "users",
        recordId: userId,
        description: `Pompier ajouté: ${data.firstName} ${data.lastName} (${data.email})`,
        newValues: { firstName: data.firstName, lastName: data.lastName, email: data.email, role: data.role },
      })
    }

    try {
      revalidatePath("/dashboard/firefighters")
      revalidatePath("/dashboard/teams")
    } catch (revalidateError) {
      console.log("Revalidation failed (non-critical):", revalidateError)
    }

    return {
      success: true,
      message: "Pompier ajouté avec succès",
    }
  } catch (error) {
    console.error("Error adding firefighter:", error)
    return {
      success: false,
      message: "Erreur lors de l'ajout du pompier",
    }
  }
}

export async function getAllFirefighters() {
  noStore()

  try {
    const firefighters = await sql`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.role
      FROM users u
      ORDER BY u.last_name, u.first_name
    `

    return firefighters
  } catch (error) {
    console.error("Error getting firefighters:", error)
    return []
  }
}

export async function getAllUsers() {
  noStore()

  try {
    const users = await sql`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.role
      FROM users u
      ORDER BY u.last_name, u.first_name
    `

    return users
  } catch (error) {
    console.error("Error getting all users:", error)
    return []
  }
}

export async function updateFirefighter(
  userId: number,
  data: {
    firstName: string
    lastName: string
    email: string
    phone: string | null
    role: string
    teamIds: number[]
  },
) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { success: false, message: "Non autorisé" }
  }

  try {
    const oldUser = await sql`
      SELECT first_name, last_name, email, phone, role FROM users WHERE id = ${userId}
    `

    await sql`
      UPDATE users
      SET 
        first_name = ${data.firstName},
        last_name = ${data.lastName},
        email = ${data.email},
        phone = ${data.phone},
        role = ${data.role},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `

    await sql`
      DELETE FROM team_members WHERE user_id = ${userId}
    `

    for (const teamId of data.teamIds) {
      await sql`
        INSERT INTO team_members (user_id, team_id)
        VALUES (${userId}, ${teamId})
        ON CONFLICT DO NOTHING
      `
    }

    await createAuditLog({
      userId: user.id,
      actionType: "USER_UPDATED",
      tableName: "users",
      recordId: userId,
      description: `Pompier modifié: ${data.firstName} ${data.lastName}`,
      oldValues: oldUser[0],
      newValues: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        role: data.role,
      },
    })

    revalidatePath("/dashboard/firefighters")
    revalidatePath("/dashboard/teams")
    return { success: true, message: "Pompier mis à jour avec succès" }
  } catch (error) {
    console.error("Error updating firefighter:", error)
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue"
    return {
      success: false,
      message: `Erreur lors de la mise à jour du pompier: ${errorMessage}`,
    }
  }
}

export async function deleteFirefighter(userId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const deletedUser = await sql`
      SELECT first_name, last_name, email FROM users WHERE id = ${userId}
    `

    await sql`
      DELETE FROM users WHERE id = ${userId}
    `

    if (deletedUser.length > 0) {
      await createAuditLog({
        userId: user.id,
        actionType: "USER_DELETED",
        tableName: "users",
        recordId: userId,
        description: `Pompier supprimé: ${deletedUser[0].first_name} ${deletedUser[0].last_name} (${deletedUser[0].email})`,
        oldValues: deletedUser[0],
      })
    }

    revalidatePath("/dashboard/firefighters")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la suppression" }
  }
}

export async function updateFirefighterRole(userId: number, role: string) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const oldUser = await sql`
      SELECT first_name, last_name, role FROM users WHERE id = ${userId}
    `

    await sql`
      UPDATE users
      SET role = ${role}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `

    if (oldUser.length > 0) {
      await createAuditLog({
        userId: user.id,
        actionType: "USER_ROLE_UPDATED",
        tableName: "users",
        recordId: userId,
        description: `Rôle modifié pour ${oldUser[0].first_name} ${oldUser[0].last_name}: ${oldUser[0].role} → ${role}`,
        oldValues: { role: oldUser[0].role },
        newValues: { role },
      })
    }

    revalidatePath("/dashboard/firefighters")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la mise à jour du rôle" }
  }
}
