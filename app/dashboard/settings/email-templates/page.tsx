import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getAllEmailTemplates } from "@/app/actions/email-templates"
import { EmailTemplatesList } from "@/components/email-templates-list"
import { UpdateTemplatesButton } from "@/components/update-templates-button"

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
        <div className="mt-4">
          <UpdateTemplatesButton />
        </div>
      </div>

      <EmailTemplatesList templates={templates} />
    </div>
  )
}
