import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { hashPassword } from "@/app/actions/auth"

// ENDPOINT TEMPORAIRE - À SUPPRIMER APRÈS UTILISATION
export async function POST() {
  try {
    // Générer le hash pour SSIV2026
    const hashedPassword = await hashPassword("SSIV2026")

    // Mettre à jour tous les utilisateurs
    const result = await sql`
      UPDATE users 
      SET password = ${hashedPassword}
      WHERE id IS NOT NULL
    `

    return NextResponse.json({
      success: true,
      message: `${result.length} utilisateurs ont été réinitialisés au mot de passe SSIV2026`,
      usersUpdated: result.length,
    })
  } catch (error) {
    console.error("Erreur lors de la réinitialisation des mots de passe:", error)
    return NextResponse.json({ success: false, error: "Erreur lors de la réinitialisation" }, { status: 500 })
  }
}
