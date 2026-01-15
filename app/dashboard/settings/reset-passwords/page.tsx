import { getSession } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import { ResetPasswordsForm } from "@/components/reset-passwords-form"

export const dynamic = "force-dynamic"

export default async function ResetPasswordsPage() {
  const user = await getSession()

  if (!user) {
    redirect("/login")
  }

  // Only owners can access this page
  if (!user.is_owner) {
    redirect("/dashboard/settings")
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Réinitialisation des mots de passe</h1>
        <p className="text-muted-foreground">Réinitialiser tous les mots de passe au mot de passe par défaut</p>
      </div>

      <ResetPasswordsForm />
    </div>
  )
}
