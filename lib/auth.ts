import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { neon } from "@neondatabase/serverless"

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
  console.log("[v0] getSession: Starting...")

  try {
    const sqlClient = neon(process.env.DATABASE_URL!)
    console.log("[v0] getSession: SQL client created")

    const cookieStore = await cookies()
    console.log("[v0] getSession: Cookie store obtained")

    const userId = cookieStore.get("userId")?.value
    console.log("[v0] getSession: userId from cookie:", userId)

    if (!userId) {
      console.log("[v0] getSession: No userId found in cookies")
      return null
    }

    console.log("[v0] getSession: Executing SQL query for userId:", userId)
    const result = await sqlClient`
      SELECT id, email, first_name, last_name, role, is_admin, phone
      FROM users
      WHERE id = ${Number.parseInt(userId)}
    `
    console.log("[v0] getSession: SQL query result:", JSON.stringify(result))

    if (result.length === 0) {
      console.log("[v0] getSession: No user found in database")
      return null
    }

    console.log("[v0] getSession: User found:", result[0].email)
    return result[0] as User
  } catch (error) {
    console.error("[v0] getSession: Error occurred:", error)
    return null
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete("session")
  cookieStore.delete("userId")
}
