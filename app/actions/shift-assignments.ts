"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getShiftAssignments(shiftId: number) {
  const assignments = await sql`
    SELECT 
      sa.id,
      sa.shift_id,
      sa.user_id,
      sa.assigned_at,
      u.first_name,
      u.last_name,
      u.role,
      u.email
    FROM shift_assignments sa
    JOIN users u ON sa.user_id = u.id
    WHERE sa.shift_id = ${shiftId}
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
  return assignments
}

export async function assignFirefighterToShift(shiftId: number, userId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    // Check if shift already has 8 firefighters
    const count = await sql`
      SELECT COUNT(*) as count FROM shift_assignments WHERE shift_id = ${shiftId}
    `

    if (count[0].count >= 8) {
      return { error: "Ce quart a déjà 8 pompiers assignés" }
    }

    await sql`
      INSERT INTO shift_assignments (shift_id, user_id)
      VALUES (${shiftId}, ${userId})
      ON CONFLICT (shift_id, user_id) DO NOTHING
    `

    revalidatePath("/dashboard/calendar")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de l'assignation" }
  }
}

export async function removeFirefighterFromShift(shiftId: number, userId: number) {
  const user = await getSession()
  if (!user?.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    await sql`
      DELETE FROM shift_assignments
      WHERE shift_id = ${shiftId} AND user_id = ${userId}
    `

    revalidatePath("/dashboard/calendar")
    return { success: true }
  } catch (error) {
    return { error: "Erreur lors de la suppression" }
  }
}

export async function getTeamFirefighters(teamId: number) {
  const firefighters = await sql`
    SELECT 
      u.id,
      u.first_name,
      u.last_name,
      u.role,
      u.email
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
  return firefighters
}
