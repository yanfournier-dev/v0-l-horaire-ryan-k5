"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/app/actions/auth"

// Helper function to check if user is admin
export async function isUserAdmin(userId?: number): Promise<boolean> {
  try {
    const session = await getSession()

    if (!session) return false

    const userIdToCheck = userId || session.id

    const result = await sql`
      SELECT role, is_admin
      FROM users
      WHERE id = ${userIdToCheck}
    `

    if (result.length === 0) {
      return false
    }

    const user = result[0]
    const isAdmin = user.role === "captain" || user.is_admin === true

    // Captains are always admin OR user has is_admin flag
    return isAdmin
  } catch (error) {
    console.error("isUserAdmin: Error", error)
    return false
  }
}

export async function getAllUsersWithAdminStatus() {
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
        is_owner,
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
    console.error("getAllUsersWithAdminStatus: Error", error)
    return {
      success: false,
      error: "Erreur lors de la récupération des utilisateurs",
    }
  }
}

export async function toggleUserAdminStatus(userId: number, makeAdmin: boolean) {
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

    return {
      success: true,
      message: makeAdmin ? "Utilisateur promu administrateur" : "Privilèges administrateur retirés",
    }
  } catch (error) {
    console.error("toggleUserAdminStatus: Error", error)
    return {
      success: false,
      error: "Erreur lors de la modification du statut",
    }
  }
}
