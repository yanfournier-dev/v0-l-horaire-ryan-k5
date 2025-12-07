"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createOrUpdateShiftNote, deleteShiftNote } from "@/app/actions/shift-notes"
import { Loader2, Trash2 } from "lucide-react"

interface ShiftNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shiftId: number
  shiftDate: string
  teamName: string
  shiftType: string
  existingNote?: {
    id: number
    note: string
    creator_first_name?: string
    creator_last_name?: string
    created_at: string
    updated_at: string
  } | null
  isAdmin: boolean
  onNoteChange?: () => void
}

export function ShiftNoteDialog({
  open,
  onOpenChange,
  shiftId,
  shiftDate,
  teamName,
  shiftType,
  existingNote,
  isAdmin,
  onNoteChange,
}: ShiftNoteDialogProps) {
  const [note, setNote] = useState(existingNote?.note || "")
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const router = useRouter()

  const scrollToToday = (attempt = 1, maxAttempts = 10) => {
    console.log("[v0] scrollToToday: Attempt", attempt, "of", maxAttempts)
    const today = new Date()
    const todayStr = today.toISOString().split("T")[0]
    const todayElement = document.getElementById(`day-${todayStr}`)

    console.log("[v0] scrollToToday: Looking for element:", `day-${todayStr}`)
    console.log("[v0] scrollToToday: Element found:", !!todayElement)

    if (todayElement) {
      console.log("[v0] scrollToToday: Scrolling to today")
      todayElement.scrollIntoView({
        behavior: "instant",
        block: "center",
      })
      console.log("[v0] scrollToToday: Scroll complete")
    } else if (attempt < maxAttempts) {
      console.log("[v0] scrollToToday: Element not found, retrying in 100ms")
      setTimeout(() => scrollToToday(attempt + 1, maxAttempts), 100)
    } else {
      console.log("[v0] scrollToToday: Element not found after", maxAttempts, "attempts")
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    const result = await createOrUpdateShiftNote(shiftId, shiftDate, note)
    setIsLoading(false)

    if (result.success) {
      onOpenChange(false)
      if (onNoteChange) {
        onNoteChange()
      }
      router.refresh()
    } else {
      alert(result.error || "Erreur lors de la sauvegarde")
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    const result = await deleteShiftNote(shiftId, shiftDate)
    setIsDeleting(false)

    if (result.success) {
      setShowDeleteConfirm(false)
      onOpenChange(false)
      if (onNoteChange) {
        onNoteChange()
      }
      router.refresh()
    } else {
      alert(result.error || "Erreur lors de la suppression")
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("fr-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getShiftTypeLabel = (type: string) => {
    if (type === "day") return "Jour"
    if (type === "night") return "Nuit"
    if (type === "full_24h") return "24h"
    return type
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Note pour le quart - {teamName} ({getShiftTypeLabel(shiftType)})
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{formatDate(shiftDate)}</p>
          </DialogHeader>

          <div className="space-y-4">
            {existingNote && (
              <div className="text-xs text-muted-foreground">
                {existingNote.creator_first_name && existingNote.creator_last_name && (
                  <p>
                    Créée par {existingNote.creator_first_name} {existingNote.creator_last_name}
                  </p>
                )}
                <p>Dernière modification: {new Date(existingNote.updated_at).toLocaleString("fr-CA")}</p>
              </div>
            )}

            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Inscrivez une note pour ce quart (situations particulières, détails sur les heures effectuées, etc.)"
              className="min-h-[200px]"
              disabled={!isAdmin}
            />

            {!isAdmin && (
              <p className="text-sm text-muted-foreground italic">
                Seuls les administrateurs peuvent créer ou modifier des notes.
              </p>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {existingNote && isAdmin && (
                <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} disabled={isDeleting}>
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {isAdmin ? "Annuler" : "Fermer"}
              </Button>
              {isAdmin && (
                <Button onClick={handleSave} disabled={isLoading || !note.trim()}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sauvegarde...
                    </>
                  ) : (
                    "Sauvegarder"
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette note ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
