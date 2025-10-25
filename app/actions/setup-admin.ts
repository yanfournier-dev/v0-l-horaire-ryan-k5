"use server"

import { sql } from "@/lib/db"
import { hashPassword } from "@/app/actions/auth"

export async function setupAdminUser() {
  try {
    console.log("[v0] Starting admin setup...")

    // Hash the password
    const hashedPassword = await hashPassword("admin123")
    console.log("[v0] Password hashed successfully")

    // Check if admin user exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = 'admin@caserne.ca'
    `
    console.log("[v0] Checked for existing user:", existingUser.length > 0)

    if (existingUser.length > 0) {
      // Update existing admin user
      await sql`
        UPDATE users 
        SET password_hash = ${hashedPassword}, is_admin = true
        WHERE email = 'admin@caserne.ca'
      `
      console.log("[v0] Admin user updated")
      return {
        success: true,
        message: "Mot de passe admin mis à jour",
      }
    } else {
      // Create new admin user
      await sql`
        INSERT INTO users (email, password_hash, first_name, last_name, role, is_admin)
        VALUES ('admin@caserne.ca', ${hashedPassword}, 'Admin', 'Système', 'captain', true)
      `
      console.log("[v0] Admin user created")
      return {
        success: true,
        message: "Utilisateur admin créé avec succès",
      }
    }
  } catch (error) {
    console.error("[v0] Error setting up admin:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    }
  }
}
