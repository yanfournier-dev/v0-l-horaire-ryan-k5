import { neon } from "@neondatabase/serverless"
import { webcrypto } from "crypto"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set")
}
const sql = neon(databaseUrl)

// Embedded hashPassword function (copied from app/actions/auth.ts)
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)

  // Generate a random salt
  const salt = new Uint8Array(16)
  webcrypto.getRandomValues(salt)

  // Import the password as a key
  const key = await webcrypto.subtle.importKey("raw", data, { name: "PBKDF2" }, false, ["deriveBits"])

  // Derive bits using PBKDF2
  const derivedBits = await webcrypto.subtle.deriveBits(
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
  try {
    console.log("Génération du hash pour SSIV2026...")
    const hashedPassword = await hashPassword("SSIV2026")
    console.log("Hash généré:", hashedPassword.substring(0, 50) + "...")

    console.log("Mise à jour de tous les utilisateurs...")
    const result = await sql`
      UPDATE users 
      SET password_hash = ${hashedPassword}
      RETURNING id
    `

    console.log(`✓ Succès! ${result.length} utilisateurs mis à jour`)
    console.log("Tous les utilisateurs peuvent maintenant se connecter avec: SSIV2026")

    return result.length
  } catch (error) {
    console.error("Erreur:", error)
    throw error
  }
}

resetAllPasswords()
