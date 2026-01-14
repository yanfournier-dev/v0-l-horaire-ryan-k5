import { getTelegramConnectionStatus } from "@/app/actions/telegram-status"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export async function TelegramAlertWidget() {
  const data = await getTelegramConnectionStatus()

  if ("error" in data || data.stats.requiredNotConnected === 0) {
    return null
  }

  const { stats } = data

  return (
    <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-red-900 dark:text-red-100">
            {stats.requiredNotConnected} pompier{stats.requiredNotConnected > 1 ? "s n'ont" : " n'a"} pas connecté
            Telegram
          </span>
        </div>
        <Link
          href="/dashboard/settings/telegram-status"
          className="text-sm text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 underline underline-offset-4 whitespace-nowrap"
        >
          Voir les statuts
        </Link>
      </div>
    </div>
  )
}
