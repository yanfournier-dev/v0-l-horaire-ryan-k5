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

interface DeliverySummary {
  successCount: number
  partialCount: number
  failedCount: number
  skippedCount: number
}

interface DeliveryDetail {
  name: string
  channels: {
    inApp: boolean
    email: boolean | "disabled"
    telegram: boolean | "disabled" | "not_connected" | "failed" | "sent"
  }
  status: "success" | "partial" | "failed" | "skipped"
}

export function SendNotificationForm() {
  const [message, setMessage] = useState("")
  const [firefighters, setFirefighters] = useState<Firefighter[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [sending, setSending] = useState(false)
  const [deliverySummary, setDeliverySummary] = useState<DeliverySummary | null>(null)
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetail[]>([]) // Store detailed delivery info

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

    console.log("[v0] handleSubmit: Starting submission")
    setSending(true)
    setDeliverySummary(null)
    setDeliveryDetails([]) // Reset details

    try {
      const result = await sendManualNotification(message.trim(), selectedIds)
      console.log("[v0] handleSubmit: Result received", result)

      if (result.success) {
        setDeliverySummary(result.summary)
        setDeliveryDetails(result.deliveryDetails || []) // Store delivery details
        setMessage("")
        setSelectedIds([])
        setSelectAll(false)
      } else {
        alert(`Erreur: ${result.error}`)
      }
    } catch (error) {
      console.error("[v0] Error sending notification:", error)
      alert("Une erreur est survenue lors de l'envoi")
    } finally {
      console.log("[v0] handleSubmit: Finally block - resetting sending state")
      setSending(false)
    }
  }

  const charCount = message.length
  const maxChars = 500

  const getTelegramStatusMessage = (telegramStatus: boolean | "disabled" | "not_connected" | "failed" | "sent") => {
    if (telegramStatus === "sent" || telegramStatus === true) {
      return { text: "Telegram envoyé", color: "text-green-600", icon: "✓" }
    }
    if (telegramStatus === "disabled") {
      return { text: "Telegram désactivé", color: "text-red-600", icon: "✗" }
    }
    if (telegramStatus === "not_connected") {
      return { text: "Telegram non connecté", color: "text-red-600", icon: "✗" }
    }
    if (telegramStatus === "failed" || telegramStatus === false) {
      return { text: "Échec d'envoi Telegram", color: "text-red-600", icon: "✗" }
    }
    return { text: "Statut inconnu", color: "text-gray-600", icon: "○" }
  }

  const getTelegramStats = () => {
    const sent = deliveryDetails.filter((d) => d.channels.telegram === "sent" || d.channels.telegram === true).length
    const notSent = deliveryDetails.length - sent
    return { sent, notSent }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {deliverySummary && (
        <Card className="border-green-500 bg-green-50">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-green-900">Notification envoyée</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeliverySummary(null)
                    setDeliveryDetails([])
                  }}
                  className="text-green-700 hover:text-green-900"
                >
                  Fermer
                </Button>
              </div>

              {deliveryDetails.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {deliveryDetails.map((detail, index) => {
                    const telegramStatus = getTelegramStatusMessage(detail.channels.telegram)
                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded border ${
                          telegramStatus.icon === "✓" ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"
                        }`}
                      >
                        <span className={`font-semibold text-lg ${telegramStatus.color}`}>{telegramStatus.icon}</span>
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">{detail.name}</span>
                          <span className={`ml-2 text-sm ${telegramStatus.color}`}>- {telegramStatus.text}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="pt-2 border-t border-green-200 space-y-1">
                <div className="text-sm font-semibold text-green-900">
                  Total: {deliveryDetails.length} destinataire(s)
                </div>
                {deliveryDetails.length > 0 && (
                  <>
                    <div className="text-sm text-green-700">
                      • {getTelegramStats().sent} notification(s) Telegram envoyée(s)
                    </div>
                    {getTelegramStats().notSent > 0 && (
                      <div className="text-sm text-red-700">
                        • {getTelegramStats().notSent} non envoyée(s) (désactivé/non connecté/échec)
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
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
