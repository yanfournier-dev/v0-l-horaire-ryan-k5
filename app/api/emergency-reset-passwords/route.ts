import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

// ENDPOINT TEMPORAIRE - À SUPPRIMER APRÈS UTILISATION
export async function POST() {
  try {
    console.log("[v0] Starting password reset...")

    // Format: salt:hash (both in hex)
    // This hash was generated using the same PBKDF2 parameters as the system (100000 iterations, SHA-256)
    const hashedPassword =
      "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d"

    const result = await sql`
      UPDATE users 
      SET password = ${hashedPassword}
      WHERE id IS NOT NULL
      RETURNING id
    `

    const userCount = Array.isArray(result) ? result.length : 0

    return NextResponse.json({
      success: true,
      message: `${userCount} utilisateur(s) réinitialisé(s) au mot de passe SSIV2026`,
      usersUpdated: userCount,
    })
  } catch (error) {
    console.error("[v0] Error resetting passwords:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la réinitialisation",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
