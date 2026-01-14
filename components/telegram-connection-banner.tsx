"use client"

import { AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useState } from "react"

export function TelegramConnectionBanner({ isConnected }: { isConnected: boolean }) {
  const [dismissed, setDismissed] = useState(false)

  if (isConnected || dismissed) {
    return null
  }

  return (
    <div className="bg-orange-50 dark:bg-orange-950 border-b border-orange-200 dark:border-orange-800">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                Connectez Telegram pour recevoir les notifications critiques de remplacement
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                Telegram est obligatoire pour vous assurer de ne jamais manquer une notification importante.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
              <Link href="/dashboard/settings/notifications">Connecter maintenant</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Fermer</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
