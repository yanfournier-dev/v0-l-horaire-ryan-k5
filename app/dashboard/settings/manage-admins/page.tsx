import { getAllUsersWithAdminStatus } from "@/app/actions/admin"
import { ManageAdminsClient } from "@/components/manage-admins-client"

export const metadata = {
  title: "Gestion des administrateurs - Horaire SSIV",
  description: "Gérer les privilèges administrateurs des utilisateurs",
}

export default async function ManageAdminsPage() {
  const result = await getAllUsersWithAdminStatus()

  if (!result.success) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{result.error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gestion des administrateurs</h1>
        <p className="text-muted-foreground mt-2">
          Attribuez ou retirez les privilèges administrateurs aux utilisateurs. Les capitaines sont toujours
          administrateurs.
        </p>
      </div>

      <ManageAdminsClient users={result.users} />
    </div>
  )
}
