import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { hashPassword } from "@/app/actions/auth"

async function resetPassword() {
  try {
    console.log("[v0] Starting password reset for Yan Fournier...")

    // Hash le nouveau mot de passe avec PBKDF2
    const newPassword = "Pompier2025!"
    console.log("[v0] Hashing password...")
    const hashedPassword = await hashPassword(newPassword)
    console.log("[v0] Password hashed successfully")

    const result = await sql`
      UPDATE users
      SET password_hash = ${hashedPassword}
      WHERE email = 'yan.fournier@victoriaville.ca'
      RETURNING id, email, first_name, last_name
    `

    console.log("[v0] Password reset result:", result)

    if (result.length === 0) {
      console.log("[v0] User not found with email yan.fournier@victoriaville.ca")
      return NextResponse.json(
        { error: "Utilisateur non trouvé avec l'email yan.fournier@victoriaville.ca" },
        { status: 404 },
      )
    }

    console.log("[v0] Password reset successful for user:", result[0])
    return NextResponse.json({
      success: true,
      message: "Mot de passe réinitialisé avec succès!",
      email: "yan.fournier@victoriaville.ca",
      newPassword: "Pompier2025!",
      user: result[0],
    })
  } catch (error) {
    console.error("[v0] Erreur lors de la réinitialisation du mot de passe:", error)
    return NextResponse.json(
      {
        error: "Erreur lors de la réinitialisation du mot de passe",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return resetPassword()
}

export async function POST() {
  return resetPassword()
}
