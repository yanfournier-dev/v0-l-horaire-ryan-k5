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
    <div className="bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Connectez Telegram pour recevoir les notifications critiques de remplacement
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                Telegram est obligatoire pour vous assurer de ne jamais manquer une notification importante.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="bg-red-600 hover:bg-red-700 text-white">
              <Link href="/dashboard/settings/notifications">Connecter maintenant</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900"
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
