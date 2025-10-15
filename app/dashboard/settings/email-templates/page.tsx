import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getAllEmailTemplates } from "@/app/actions/email-templates"
import { EmailTemplatesList } from "@/components/email-templates-list"
import { SyncEmailTemplatesButton } from "@/components/sync-email-templates-button"

export const dynamic = "force-dynamic"

export default async function EmailTemplatesPage() {
  const user = await getSession()
  if (!user) {
    redirect("/login")
  }

  console.log("[v0] Email templates page - user:", user.email, "is_admin:", user.is_admin)

  if (!user.is_admin) {
    console.log("[v0] User is not admin, redirecting to dashboard")
    redirect("/dashboard")
  }

  const templates = await getAllEmailTemplates()

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-balance">Templates d'email</h1>
        <p className="text-muted-foreground mt-2">
          Personnalisez les messages envoyés par email pour chaque type de notification
        </p>
        <div className="mt-4 flex gap-2">
          <SyncEmailTemplatesButton />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Utilisez le bouton ci-dessus pour mettre à jour les templates avec les dernières modifications du code
        </p>
      </div>

      <EmailTemplatesList templates={templates} />
    </div>
  )
}
