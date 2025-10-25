import { getSession } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import { getUserPreferences } from "@/app/actions/notifications"
import { NotificationPreferencesForm } from "@/components/notification-preferences-form"

export const dynamic = "force-dynamic"

export default async function NotificationSettingsPage() {
  const user = await getSession()
  if (!user) {
    redirect("/login")
  }

  const preferences = await getUserPreferences(user.id)

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-balance">Préférences de notification</h1>
        <p className="text-muted-foreground mt-2">Choisissez comment vous souhaitez recevoir vos notifications</p>
      </div>

      <NotificationPreferencesForm userId={user.id} initialPreferences={preferences} />
    </div>
  )
}
