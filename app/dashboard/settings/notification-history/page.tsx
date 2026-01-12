import { Suspense } from "react"
import { NotificationHistoryList } from "@/components/notification-history-list"

export default function NotificationHistoryPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Historique des notifications</h1>
        <p className="text-muted-foreground mt-2">
          Consultez l'historique complet de toutes les notifications envoyées avec leurs détails de livraison.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="rounded-lg border p-8 text-center text-muted-foreground">Chargement de l'historique...</div>
        }
      >
        <NotificationHistoryList />
      </Suspense>
    </div>
  )
}
