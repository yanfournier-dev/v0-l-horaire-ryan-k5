import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    console.log("[v0] Starting admin account creation/reset...")

    const email = "admin@caserne.ca"
    const password = "admin123"

    // Generate PBKDF2 hash for the password
    console.log("[v0] Generating password hash...")
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const salt = crypto.getRandomValues(new Uint8Array(16))

    const key = await crypto.subtle.importKey("raw", data, { name: "PBKDF2" }, false, ["deriveBits"])

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

    const hashArray = new Uint8Array(derivedBits)
    const combined = new Uint8Array(salt.length + hashArray.length)
    combined.set(salt)
    combined.set(hashArray, salt.length)

    const hashedPassword = Buffer.from(combined).toString("base64")
    console.log("[v0] Password hash generated successfully")

    // Delete existing admin account if it exists
    console.log("[v0] Deleting existing admin account...")
    await sql`DELETE FROM users WHERE email = ${email}`

    // Create new admin account
    console.log("[v0] Creating new admin account...")
    await sql`
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_admin)
      VALUES (${email}, ${hashedPassword}, 'Admin', 'Système', 'captain', TRUE)
    `

    console.log("[v0] Admin account created successfully!")

    return NextResponse.json({
      success: true,
      message: "Compte admin créé avec succès!",
      credentials: {
        email: email,
        password: password,
      },
    })
  } catch (error) {
    console.error("[v0] Error creating admin account:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la création du compte admin",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
