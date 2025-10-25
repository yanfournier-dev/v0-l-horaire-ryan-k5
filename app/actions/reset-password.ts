"use server"

import { sql } from "@/lib/db"
import { hashPassword } from "@/app/actions/auth"

export async function resetUserPassword(email: string, newPassword: string) {
  console.log("[v0] Resetting password for:", email)

  try {
    // Hash the password with PBKDF2
    const passwordHash = await hashPassword(newPassword)
    console.log("[v0] Password hashed successfully")

    // Update user's password
    const result = await sql`
      UPDATE users 
      SET password_hash = ${passwordHash}
      WHERE email = ${email}
      RETURNING id, first_name, last_name, email
    `

    if (result.length > 0) {
      console.log("[v0] ✓ Password reset successful for:", result[0].first_name, result[0].last_name)
      return {
        success: true,
        user: result[0],
      }
    } else {
      console.log("[v0] ✗ User not found with email:", email)
      return {
        success: false,
        error: "Utilisateur non trouvé",
      }
    }
  } catch (error) {
    console.error("[v0] Error resetting password:", error)
    return {
      success: false,
      error: "Erreur lors de la réinitialisation du mot de passe",
    }
  }
}

// Quick function to reset Yan Fournier's password specifically
export async function resetYanPassword() {
  return resetUserPassword("yan.fournier@victoriaville.ca", "Pompier2025!")
}
