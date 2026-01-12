"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { sendManualNotification, getFirefighters } from "@/app/actions/send-manual-notification"
import { Label } from "@/components/ui/label"

interface Firefighter {
  id: number
  name: string
  email: string
}

export function SendNotificationForm() {
  const [message, setMessage] = useState("")
  const [firefighters, setFirefighters] = useState<Firefighter[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Fetch all firefighters
    async function fetchFirefighters() {
      try {
        console.log("[v0] Fetching firefighters...")
        const result = await getFirefighters()
        console.log("[v0] getFirefighters result:", result)
        if (result.success) {
          console.log("[v0] Firefighters loaded:", result.firefighters.length)
          setFirefighters(result.firefighters)
        } else {
          console.log("[v0] Error from getFirefighters:", result.error)
        }
      } catch (error) {
        console.error("[v0] Error fetching firefighters:", error)
      }
    }
    fetchFirefighters()
  }, [])

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedIds(firefighters.map((f) => f.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleFirefighter = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter((fid) => fid !== id))
      setSelectAll(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (message.trim().length === 0) {
      alert("Veuillez entrer un message")
      return
    }

    if (selectedIds.length === 0) {
      alert("Veuillez sélectionner au moins un destinataire")
      return
    }

    setSending(true)
    setSuccess(false)

    try {
      const result = await sendManualNotification(message.trim(), selectedIds)

      if (result.success) {
        setSuccess(true)
        setMessage("")
        setSelectedIds([])
        setSelectAll(false)

        setTimeout(() => setSuccess(false), 5000)
      } else {
        alert(`Erreur: ${result.error}`)
      }
    } catch (error) {
      console.error("[v0] Error sending notification:", error)
      alert("Une erreur est survenue lors de l'envoi")
    } finally {
      setSending(false)
    }
  }

  const charCount = message.length
  const maxChars = 500

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          Notification envoyée avec succès à {selectedIds.length} pompier(s)!
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            placeholder="Entrez votre message..."
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, maxChars))}
            rows={6}
            className="resize-none"
          />
          <div className="text-sm text-muted-foreground text-right">
            {charCount}/{maxChars} caractères
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Destinataires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2 pb-4 border-b">
            <Checkbox id="select-all" checked={selectAll} onCheckedChange={handleSelectAll} />
            <Label htmlFor="select-all" className="font-semibold cursor-pointer">
              Sélectionner tous ({firefighters.length})
            </Label>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {firefighters.map((firefighter) => (
              <div key={firefighter.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`firefighter-${firefighter.id}`}
                  checked={selectedIds.includes(firefighter.id)}
                  onCheckedChange={(checked) => handleToggleFirefighter(firefighter.id, checked as boolean)}
                />
                <Label htmlFor={`firefighter-${firefighter.id}`} className="cursor-pointer flex-1">
                  {firefighter.name}
                </Label>
              </div>
            ))}
          </div>

          {selectedIds.length > 0 && (
            <div className="pt-4 border-t text-sm text-muted-foreground">
              {selectedIds.length} pompier(s) sélectionné(s)
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={sending || message.trim().length === 0 || selectedIds.length === 0} size="lg">
          {sending ? "Envoi en cours..." : "Envoyer la notification"}
        </Button>
      </div>
    </form>
  )
}
