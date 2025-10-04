"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { addPartialVariablesToTemplates } from "@/app/actions/email-templates"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export function UpdateTemplatesButton() {
  const [isUpdating, setIsUpdating] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const router = useRouter()

  const handleUpdate = async () => {
    setIsUpdating(true)
    setMessage(null)

    console.log("[v0] Updating email templates with partial variables...")

    const result = await addPartialVariablesToTemplates()

    if (result.success) {
      setMessage({ type: "success", text: result.message || "Templates mis à jour avec succès" })
      console.log("[v0] Templates updated successfully")
      router.refresh()
    } else {
      setMessage({ type: "error", text: result.error || "Erreur lors de la mise à jour" })
      console.error("[v0] Failed to update templates:", result.error)
    }

    setIsUpdating(false)
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleUpdate} disabled={isUpdating} variant="outline" size="sm">
        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Ajouter les variables de remplacement partiel
      </Button>
      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>{message.text}</p>
      )}
    </div>
  )
}
