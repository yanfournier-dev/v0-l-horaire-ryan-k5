"use server"

import { sql } from "@/lib/db"
import { getSession, hashPassword, verifyPassword } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getSession()
    if (!user) {
      return { success: false, message: "Non authentifié" }
    }

    // Get current password hash
    const result = await sql`
      SELECT password_hash FROM users WHERE id = ${user.id}
    `

    if (result.length === 0) {
      return { success: false, message: "Utilisateur non trouvé" }
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, result[0].password_hash)
    if (!isValid) {
      return { success: false, message: "Mot de passe actuel incorrect" }
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword)

    // Update password
    await sql`
      UPDATE users
      SET password_hash = ${newPasswordHash}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
    `

    return { success: true, message: "Mot de passe changé avec succès" }
  } catch (error) {
    console.error("[v0] Error changing password:", error)
    return { success: false, message: "Erreur lors du changement de mot de passe" }
  }
}

export async function resetFirefighterPassword(
  userId: number,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getSession()
    if (!user?.is_admin) {
      return { success: false, message: "Non autorisé" }
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword)

    // Update password
    await sql`
      UPDATE users
      SET password_hash = ${newPasswordHash}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `

    revalidatePath("/dashboard/firefighters")
    return { success: true, message: "Mot de passe réinitialisé avec succès" }
  } catch (error) {
    console.error("[v0] Error resetting password:", error)
    return { success: false, message: "Erreur lors de la réinitialisation du mot de passe" }
  }
}
