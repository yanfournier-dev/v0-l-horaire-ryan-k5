"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { syncEmailTemplatesFromCode } from "@/app/actions/email-templates"
import { useToast } from "@/hooks/use-toast"
import { RefreshCw } from "lucide-react"

export function SyncEmailTemplatesButton() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSync = async () => {
    setIsLoading(true)
    try {
      const result = await syncEmailTemplatesFromCode()

      if (result.success) {
        toast({
          title: "Synchronisation réussie",
          description: result.message,
        })
        // Refresh the page to show updated templates
        window.location.reload()
      } else {
        toast({
          title: "Erreur",
          description: result.error || "Impossible de synchroniser les templates",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la synchronisation",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={handleSync} disabled={isLoading} variant="outline">
      <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
      {isLoading ? "Synchronisation..." : "Synchroniser avec le code"}
    </Button>
  )
}
