"use server"

import { sql } from "@/lib/db"
import { hashPassword, verifyPassword, createSession, destroySession } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function login(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email et mot de passe requis" }
  }

  const result = await sql`
    SELECT id, email, password_hash, first_name, last_name, role, is_admin
    FROM users
    WHERE email = ${email}
  `

  if (result.length === 0) {
    return { error: "Email ou mot de passe incorrect" }
  }

  const user = result[0]
  const isValid = await verifyPassword(password, user.password_hash)

  if (!isValid) {
    return { error: "Email ou mot de passe incorrect" }
  }

  await createSession(user.id)
  redirect("/dashboard")
}

export async function register(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const phone = formData.get("phone") as string

  if (!email || !password || !firstName || !lastName) {
    return { error: "Tous les champs sont requis" }
  }

  // Check if user already exists
  const existing = await sql`
    SELECT id FROM users WHERE email = ${email}
  `

  if (existing.length > 0) {
    return { error: "Cet email est déjà utilisé" }
  }

  const passwordHash = await hashPassword(password)

  const result = await sql`
    INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
    VALUES (${email}, ${passwordHash}, ${firstName}, ${lastName}, ${phone || null}, 'firefighter')
    RETURNING id
  `

  await createSession(result[0].id)
  redirect("/dashboard")
}

export async function logout() {
  await destroySession()
  redirect("/login")
}
