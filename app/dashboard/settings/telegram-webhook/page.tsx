import { getSession } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TelegramWebhookSetup } from "@/components/telegram-webhook-setup"

export const dynamic = "force-dynamic"

export default async function TelegramWebhookPage() {
  const user = await getSession()

  if (!user) {
    redirect("/login")
  }

  if (!user.is_owner) {
    redirect("/dashboard")
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Configuration Telegram</h1>
        <p className="text-muted-foreground">Configurer le webhook Telegram pour activer les boutons de confirmation</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Telegram</CardTitle>
          <CardDescription>
            Cette configuration permet aux pompiers de confirmer la réception de leurs assignations directement depuis
            Telegram en cliquant sur un bouton.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TelegramWebhookSetup />
        </CardContent>
      </Card>
    </div>
  )
}
