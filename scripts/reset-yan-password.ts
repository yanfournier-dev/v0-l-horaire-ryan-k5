import { sql } from "@/lib/db"
import { hashPassword } from "@/app/actions/auth"

async function resetYanPassword() {
  console.log("[v0] Resetting Yan Fournier's password...")

  const email = "yan.fournier@victoriaville.ca"
  const newPassword = "Pompier2025!"

  try {
    // Hash the password with the new PBKDF2 system
    const passwordHash = await hashPassword(newPassword)
    console.log("[v0] Password hashed successfully with PBKDF2")

    // Update Yan Fournier's password
    const result = await sql`
      UPDATE users 
      SET password_hash = ${passwordHash}
      WHERE email = ${email}
      RETURNING id, first_name, last_name, email
    `

    if (result.length > 0) {
      console.log("[v0] ✓ Password reset successful for:", result[0].first_name, result[0].last_name)
      console.log("[v0] Email:", result[0].email)
      console.log("[v0] New password:", newPassword)
      console.log("[v0] Yan Fournier can now log in with these credentials")
    } else {
      console.log("[v0] ✗ User not found with email:", email)
    }
  } catch (error) {
    console.error("[v0] Error resetting password:", error)
    throw error
  }
}

resetYanPassword().catch((error) => {
  console.error("[v0] Script failed:", error)
  process.exit(1)
})
