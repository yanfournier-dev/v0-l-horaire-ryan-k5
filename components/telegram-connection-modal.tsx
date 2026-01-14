"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

export function TelegramConnectionModal({ isConnected }: { isConnected: boolean }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!isConnected) {
      // Check if modal was shown in the last 24 hours
      const lastShown = localStorage.getItem("telegramModalLastShown")
      const now = Date.now()

      if (!lastShown || now - Number.parseInt(lastShown) > 24 * 60 * 60 * 1000) {
        // Show modal after a short delay
        setTimeout(() => {
          setOpen(true)
          localStorage.setItem("telegramModalLastShown", now.toString())
        }, 1000)
      }
    }
  }, [isConnected])

  const handleConnectNow = () => {
    setOpen(false)
    router.push("/dashboard/settings/notifications")
  }

  const handleLater = () => {
    setOpen(false)
  }

  if (isConnected) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
              <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <DialogTitle className="text-xl">Telegram est obligatoire</DialogTitle>
          </div>
          <DialogDescription className="text-base leading-relaxed">
            Pour garantir que vous recevez toutes les notifications critiques de remplacement, vous devez connecter
            votre compte Telegram.
            <br />
            <br />
            Les notifications in-app ne suffisent pas en cas d'urgence.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleLater}>
            Plus tard
          </Button>
          <Button onClick={handleConnectNow} className="bg-orange-600 hover:bg-orange-700">
            Connecter maintenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
