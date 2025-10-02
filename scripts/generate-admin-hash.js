import bcrypt from "bcryptjs"

async function generateHash() {
  const password = "admin123"
  const hash = await bcrypt.hash(password, 10)
  console.log("[v0] Generating bcrypt hash for admin password")
  console.log("[v0] Password:", password)
  console.log("[v0] Generated Hash:", hash)
  console.log("[v0] Copy this hash to update the seed script")
}

generateHash().catch(console.error)
