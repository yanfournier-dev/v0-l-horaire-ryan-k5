"use server"

import { sql } from "@/lib/db"
import { getSession, hashPassword } from "./auth"
import { revalidatePath } from "next/cache"

export async function resetAllPasswordsToDefault() {
  const user = await getSession()

  // Only owners can reset all passwords
  if (!user?.is_owner) {
    return { error: "Non autorisé. Seul le propriétaire peut réinitialiser tous les mots de passe." }
  }

  try {
    // Hash the default password "SSIV2026"
    const defaultPassword = "SSIV2026"
    const hashedPassword = await hashPassword(defaultPassword)

    // Update all users with the new password
    await sql`
      UPDATE users 
      SET password = ${hashedPassword}
      WHERE id IS NOT NULL
    `

    // Get count of updated users
    const result = await sql`
      SELECT COUNT(*) as count FROM users
    `
    const count = result.rows[0]?.count || 0

    revalidatePath("/dashboard/settings/reset-passwords")

    return {
      success: true,
      message: `${count} utilisateur(s) ont été réinitialisés au mot de passe par défaut: ${defaultPassword}`,
    }
  } catch (error) {
    console.error("Error resetting passwords:", error)
    return { error: "Erreur lors de la réinitialisation des mots de passe" }
  }
}
