import { getTelegramConnectionStatus } from "@/app/actions/telegram-status"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export async function TelegramAlertWidget() {
  const data = await getTelegramConnectionStatus()

  if ("error" in data || data.stats.requiredNotConnected === 0) {
    return null
  }

  const { stats } = data

  // Compact horizontal alert banner
  return (
    <div className="rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950 px-4 py-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
          <span className="text-orange-900 dark:text-orange-100">
            {stats.requiredNotConnected} pompier{stats.requiredNotConnected > 1 ? "s n'ont" : " n'a"} pas connecté
            Telegram
          </span>
        </div>
        <Link
          href="/dashboard/settings/telegram-status"
          className="text-sm text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-100 underline underline-offset-4 whitespace-nowrap"
        >
          Voir les statuts
        </Link>
      </div>
    </div>
  )
}
