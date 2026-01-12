import { getSession } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import { SendNotificationForm } from "@/components/send-notification-form"

export const dynamic = "force-dynamic"

export default async function SendNotificationPage() {
  const user = await getSession()

  if (!user) {
    redirect("/login")
  }

  if (!user.is_admin) {
    redirect("/dashboard")
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Envoyer une notification</h1>
        <p className="text-muted-foreground">
          Envoyez un message personnalisé aux pompiers de votre choix. Le message sera envoyé via les canaux de
          notification activés par chaque utilisateur (app, Telegram).
        </p>
      </div>

      <SendNotificationForm />
    </div>
  )
}
