import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { hashPassword } from "@/app/actions/auth"

export async function POST() {
  try {
    // Hash the password
    const hashedPassword = await hashPassword("admin123")

    // Check if admin user exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = 'admin@caserne.ca'
    `

    if (existingUser.length > 0) {
      // Update existing admin user
      await sql`
        UPDATE users 
        SET password_hash = ${hashedPassword}, is_admin = true
        WHERE email = 'admin@caserne.ca'
      `
      return NextResponse.json({
        success: true,
        message: "Mot de passe admin mis à jour",
      })
    } else {
      // Create new admin user
      await sql`
        INSERT INTO users (email, password_hash, first_name, last_name, role, is_admin)
        VALUES ('admin@caserne.ca', ${hashedPassword}, 'Admin', 'Système', 'captain', true)
      `
      return NextResponse.json({
        success: true,
        message: "Utilisateur admin créé avec succès",
      })
    }
  } catch (error) {
    console.error("[v0] Error setting up admin:", error)
    return NextResponse.json({ success: false, error: "Erreur lors de la configuration de l'admin" }, { status: 500 })
  }
}
