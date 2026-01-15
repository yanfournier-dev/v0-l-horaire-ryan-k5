// Script to reset all user passwords to "SSIV2026"
// Run with: node --loader tsx scripts/reset-passwords.ts

import { neon } from "@neondatabase/serverless"

// PBKDF2 hash function (same as in auth.ts)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)

  // Generate a random salt
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)

  // Import the password as a key
  const key = await crypto.subtle.importKey("raw", data, { name: "PBKDF2" }, false, ["deriveBits"])

  // Derive bits using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  )

  // Combine salt and hash
  const hashArray = new Uint8Array(derivedBits)
  const combined = new Uint8Array(salt.length + hashArray.length)
  combined.set(salt)
  combined.set(hashArray, salt.length)

  // Convert to base64
  return Buffer.from(combined).toString("base64")
}

async function resetAllPasswords() {
  const sql = neon(process.env.DATABASE_URL!)

  // Generate hash for "SSIV2026"
  const newPasswordHash = await hashPassword("SSIV2026")

  console.log("Generated password hash for SSIV2026")
  console.log("Resetting all user passwords...")

  // Update all users
  const result = await sql`
    UPDATE users 
    SET password = ${newPasswordHash}
    WHERE id IS NOT NULL
  `

  console.log(`✓ Successfully reset passwords for all users`)
  console.log(`  All users can now login with password: SSIV2026`)
}

resetAllPasswords().catch(console.error)
