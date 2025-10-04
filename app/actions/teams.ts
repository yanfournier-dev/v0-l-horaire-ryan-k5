"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getTeams() {
  const teams = await sql`
    SELECT 
      t.id,
      t.name,
      t.type,
      t.capacity,
      t.color,
      COUNT(tm.user_id) as member_count
    FROM teams t
    LEFT JOIN team_members tm ON t.id = tm.team_id
    GROUP BY t.id, t.name, t.type, t.capacity, t.color
    ORDER BY 
      CASE 
        WHEN t.type = 'part_time' AND t.name LIKE '%1%' THEN 1
        WHEN t.type = 'part_time' AND t.name LIKE '%2%' THEN 2
        WHEN t.type = 'part_time' AND t.name LIKE '%3%' THEN 3
        WHEN t.type = 'part_time' AND t.name LIKE '%4%' THEN 4
        WHEN t.type = 'part_time' THEN 5
        WHEN t.type = 'temporary' THEN 6
        WHEN t.type = 'permanent' AND t.name LIKE '%1%' THEN 7
        WHEN t.type = 'permanent' AND t.name LIKE '%2%' THEN 8
        WHEN t.type = 'permanent' AND t.name LIKE '%3%' THEN 9
        WHEN t.type = 'permanent' AND t.name LIKE '%4%' THEN 10
        WHEN t.type = 'permanent' THEN 11
        ELSE 12
      END,
      t.name
  `
  return teams
}

export async function getTeamMembers(teamId: number) {
  const members = await sql`
    SELECT 
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      u.role,
      u.phone,
      tm.joined_at
    FROM team_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = ${teamId}
    ORDER BY 
      CASE u.role 
        WHEN 'captain' THEN 1 
        WHEN 'lieutenant' THEN 2 
        WHEN 'pp1' THEN 3
        WHEN 'pp2' THEN 4
        WHEN 'pp3' THEN 5
        WHEN 'pp4' THEN 6
        WHEN 'pp5' THEN 7
        WHEN 'pp6' THEN 8
        WHEN 'firefighter' THEN 9 
        ELSE 10
      END,
      u.last_name
  `
  return members
}

export async function getAvailableFirefighters(teamId: number) {
  const firefighters = await sql`
    SELECT 
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      u.role
    FROM users u
    WHERE u.id NOT IN (
      SELECT user_id FROM team_members WHERE team_id = ${teamId}
    )
    ORDER BY u.last_name
  `
  return firefighters
}

export async function addMemberToTeam(teamId: number, userId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      INSERT INTO team_members (team_id, user_id)
      VALUES (${teamId}, ${userId})
    `
    revalidatePath("/dashboard/teams")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de l'ajout du membre" }
  }
}

export async function removeMemberFromTeam(teamId: number, userId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      DELETE FROM team_members
      WHERE team_id = ${teamId} AND user_id = ${userId}
    `
    revalidatePath("/dashboard/teams")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la suppression du membre" }
  }
}

export async function getAllFirefighters() {
  const firefighters = await sql`
    SELECT 
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      u.role,
      u.phone,
      u.is_admin,
      u.created_at,
      COALESCE(
        json_agg(
          json_build_object('id', t.id, 'name', t.name, 'type', t.type)
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'
      ) as teams
    FROM users u
    LEFT JOIN team_members tm ON u.id = tm.user_id
    LEFT JOIN teams t ON tm.team_id = t.id
    GROUP BY u.id
    ORDER BY u.last_name
  `
  return firefighters
}

export async function updateFirefighterRole(userId: number, role: string) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      UPDATE users
      SET role = ${role}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `
    revalidatePath("/dashboard/firefighters")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la mise à jour du rôle" }
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
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${data.email} AND id != ${userId}
    `

    if (existingUser.length > 0) {
      return {
        success: false,
        message: "Cet email est déjà utilisé par un autre pompier",
      }
    }

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

    revalidatePath("/dashboard/firefighters")
    revalidatePath("/dashboard/teams")
    return { success: true, message: "Pompier mis à jour avec succès" }
  } catch (error) {
    console.error("[v0] Error updating firefighter:", error)
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
    await sql`
      DELETE FROM users WHERE id = ${userId}
    `
    revalidatePath("/dashboard/firefighters")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la suppression" }
  }
}

export async function createTeam(data: {
  name: string
  type: "permanent" | "part_time" | "temporary"
  capacity: number | null
  color: string
}) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { success: false, message: "Non autorisé" }
  }

  try {
    // Check if team already exists
    const existingTeam = await sql`
      SELECT id FROM teams WHERE name = ${data.name}
    `

    if (existingTeam.length > 0) {
      return {
        success: false,
        message: "Une équipe avec ce nom existe déjà",
      }
    }

    const capacity = data.capacity === null ? 999 : data.capacity

    await sql`
      INSERT INTO teams (name, type, capacity, color)
      VALUES (${data.name}, ${data.type}, ${capacity}, ${data.color})
    `

    revalidatePath("/dashboard/teams")
    return { success: true, message: "Équipe créée avec succès" }
  } catch (error) {
    console.error("[v0] Error creating team:", error)
    return {
      success: false,
      message: "Erreur lors de la création de l'équipe",
    }
  }
}
