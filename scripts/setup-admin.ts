import { sql } from "@/lib/db"
import { hashPassword } from "@/lib/auth"

async function setupAdmin() {
  console.log("[v0] Setting up admin user...")

  const email = "admin@caserne.ca"
  const password = "admin123"
  const passwordHash = await hashPassword(password)

  // Check if admin exists
  const existing = await sql`
    SELECT id FROM users WHERE email = ${email}
  `

  if (existing.length > 0) {
    // Update existing admin
    await sql`
      UPDATE users 
      SET password_hash = ${passwordHash}
      WHERE email = ${email}
    `
    console.log("[v0] Admin user updated successfully")
  } else {
    // Create new admin
    await sql`
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_admin)
      VALUES (${email}, ${passwordHash}, 'Admin', 'Système', 'captain', TRUE)
    `
    console.log("[v0] Admin user created successfully")
  }

  console.log("[v0] Admin credentials:")
  console.log("[v0] Email:", email)
  console.log("[v0] Password:", password)
  console.log("[v0] You can now log in with these credentials")
}

setupAdmin().catch((error) => {
  console.error("[v0] Error setting up admin:", error)
  process.exit(1)
})
