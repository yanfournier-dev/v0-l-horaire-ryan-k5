import { getSession } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import { ResetPasswordForm } from "@/components/reset-password-form"

export default async function ResetPasswordPage() {
  const user = await getSession()

  if (!user) {
    redirect("/login")
  }

  if (!user.is_admin) {
    redirect("/dashboard")
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Réinitialiser un mot de passe</h1>
        <ResetPasswordForm />
      </div>
    </div>
  )
}
