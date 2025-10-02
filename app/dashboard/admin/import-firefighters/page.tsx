import { Suspense } from "react"
import { redirect } from "next/navigation"
import { neon } from "@neondatabase/serverless"
import { ImportFirefightersForm } from "@/components/import-firefighters-form"

const sql = neon(process.env.DATABASE_URL!)

async function getCurrentUser() {
  // This is a placeholder - replace with your actual auth logic
  const userId = 1 // Replace with actual user ID from session

  const users = await sql`
    SELECT id, first_name, last_name, email, is_admin, role
    FROM users
    WHERE id = ${userId}
  `

  return users[0] || null
}

export default async function ImportFirefightersPage() {
  const user = await getCurrentUser()

  if (!user || !user.is_admin) {
    redirect("/dashboard")
  }

  const teams = await sql`
    SELECT id, name, type, color
    FROM teams
    ORDER BY name
  `

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Importer des pompiers</h1>
        <p className="text-muted-foreground">
          Ajoutez plusieurs pompiers en une seule fois en collant leurs informations ci-dessous.
        </p>
      </div>

      <Suspense fallback={<div>Chargement...</div>}>
        <ImportFirefightersForm teams={teams} />
      </Suspense>
    </div>
  )
}
