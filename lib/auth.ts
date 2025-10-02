import { cookies } from "next/headers"
import { sql } from "./db"
import bcrypt from "bcryptjs"

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: "captain" | "lieutenant" | "firefighter"
  is_admin: boolean
  phone?: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: number): Promise<string> {
  const sessionToken = crypto.randomUUID()
  const cookieStore = await cookies()

  cookieStore.set("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })

  // Store session in a simple way (in production, use Redis or database)
  cookieStore.set("userId", userId.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })

  return sessionToken
}

export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies()
  const userId = cookieStore.get("userId")?.value

  if (!userId) {
    return null
  }

  const result = await sql`
    SELECT id, email, first_name, last_name, role, is_admin, phone
    FROM users
    WHERE id = ${Number.parseInt(userId)}
  `

  if (result.length === 0) {
    return null
  }

  return result[0] as User
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete("session")
  cookieStore.delete("userId")
}
