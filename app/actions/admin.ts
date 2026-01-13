"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/app/actions/auth"

// Helper function to check if user is admin
export async function isUserAdmin(userId?: number): Promise<boolean> {
  try {
    const session = await getSession()
    console.log("[v0] isUserAdmin: Session", session ? `User ID: ${session.id}` : "No session")

    if (!session) return false

    const userIdToCheck = userId || session.id
    console.log("[v0] isUserAdmin: Checking user ID", userIdToCheck)

    const result = await sql`
      SELECT role, is_admin
      FROM users
      WHERE id = ${userIdToCheck}
    `

    console.log("[v0] isUserAdmin: Query result", result)

    if (result.length === 0) {
      console.log("[v0] isUserAdmin: User not found")
      return false
    }

    const user = result[0]
    const isAdmin = user.role === "captain" || user.is_admin === true
    console.log("[v0] isUserAdmin: User role:", user.role, "is_admin:", user.is_admin, "Result:", isAdmin)

    // Captains are always admin OR user has is_admin flag
    return isAdmin
  } catch (error) {
    console.error("[v0] isUserAdmin: Error", error)
    return false
  }
}

export async function getAllUsersWithAdminStatus() {
  console.log("[v0] getAllUsersWithAdminStatus: Starting")

  const session = await getSession()
  if (!session) {
    return { success: false, error: "Non authentifié" }
  }

  // Check if current user is admin
  const currentUserIsAdmin = await isUserAdmin()
  if (!currentUserIsAdmin) {
    return { success: false, error: "Accès refusé - Réservé aux admins" }
  }

  try {
    const users = await sql`
      SELECT 
        id,
        first_name,
        last_name,
        email,
        role,
        is_admin,
        created_at
      FROM users
      ORDER BY 
        CASE role
          WHEN 'captain' THEN 1
          WHEN 'lieutenant' THEN 2
          WHEN 'firefighter' THEN 3
          ELSE 4
        END,
        last_name,
        first_name
    `

    console.log(`[v0] getAllUsersWithAdminStatus: Found ${users.length} users`)

    return {
      success: true,
      users: users.map((user) => ({
        ...user,
        // Captains are always admin
        isAdmin: user.role === "captain" || user.is_admin === true,
        canModifyAdmin: user.role !== "captain", // Can't remove captain admin status
      })),
    }
  } catch (error) {
    console.error("[v0] getAllUsersWithAdminStatus: Error", error)
    return {
      success: false,
      error: "Erreur lors de la récupération des utilisateurs",
    }
  }
}

export async function toggleUserAdminStatus(userId: number, makeAdmin: boolean) {
  console.log("[v0] toggleUserAdminStatus:", userId, makeAdmin)

  const session = await getSession()
  if (!session) {
    return { success: false, error: "Non authentifié" }
  }

  // Check if current user is admin
  const currentUserIsAdmin = await isUserAdmin()
  if (!currentUserIsAdmin) {
    return { success: false, error: "Accès refusé - Réservé aux admins" }
  }

  try {
    // Check if target user is a captain
    const targetUser = await sql`
      SELECT role FROM users WHERE id = ${userId}
    `

    if (targetUser.length === 0) {
      return { success: false, error: "Utilisateur introuvable" }
    }

    if (targetUser[0].role === "captain") {
      return {
        success: false,
        error: "Impossible de modifier le statut admin d'un capitaine",
      }
    }

    // Update admin status
    await sql`
      UPDATE users
      SET is_admin = ${makeAdmin}
      WHERE id = ${userId}
    `

    console.log(`[v0] toggleUserAdminStatus: Updated user ${userId} to admin=${makeAdmin}`)

    return {
      success: true,
      message: makeAdmin ? "Utilisateur promu administrateur" : "Privilèges administrateur retirés",
    }
  } catch (error) {
    console.error("[v0] toggleUserAdminStatus: Error", error)
    return {
      success: false,
      error: "Erreur lors de la modification du statut",
    }
  }
}
