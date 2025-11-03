"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { approveApplication } from "@/app/actions/replacements"
import { setActingLieutenant } from "@/app/actions/shift-assignments"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface ApproveApplicationButtonProps {
  applicationId: number
  firefighterName?: string
  isPartial?: boolean
  startTime?: string | null
  endTime?: string | null
  replacedFirefighterRole?: string
  shiftFirefighters?: Array<{
    id: number
    first_name: string
    last_name: string
    role: string
  }>
  shiftId?: number
  replacementFirefighterId?: number
}

export function ApproveApplicationButton({
  applicationId,
  firefighterName,
  isPartial,
  startTime,
  endTime,
  replacedFirefighterRole,
  shiftFirefighters,
  shiftId,
  replacementFirefighterId,
}: ApproveApplicationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showLieutenantDialog, setShowLieutenantDialog] = useState(false)
  const [selectedLieutenantId, setSelectedLieutenantId] = useState<string>("")
  const router = useRouter()

  const isReplacingLieutenant = replacedFirefighterRole === "lieutenant"

  const handleApprove = async () => {
    if (isReplacingLieutenant && shiftFirefighters && shiftId && replacementFirefighterId) {
      setShowLieutenantDialog(true)
      return
    }

    await performApproval()
  }

  const performApproval = async (lieutenantId?: number) => {
    setIsLoading(true)
    const pathParts = window.location.pathname.split("/")
    const replacementId = Number.parseInt(pathParts[pathParts.length - 1])

    const result = await approveApplication(applicationId, replacementId)

    if (result.success) {
      if (isReplacingLieutenant && result.shiftId && lieutenantId) {
        console.log("[v0] Calling setActingLieutenant with shiftId:", result.shiftId, "lieutenantId:", lieutenantId)
        await setActingLieutenant(result.shiftId, lieutenantId)
      }

      toast.success("Pompier assigné avec succès")
      setShowLieutenantDialog(false)
      setSelectedLieutenantId("")
      router.refresh()
    } else {
      toast.error(result.error || "Erreur lors de l'assignation")
    }

    setIsLoading(false)
  }

  const handleLieutenantSelection = async () => {
    const lieutenantId = selectedLieutenantId ? Number.parseInt(selectedLieutenantId) : replacementFirefighterId

    if (!lieutenantId) {
      toast.error("Veuillez sélectionner un lieutenant")
      return
    }

    await performApproval(lieutenantId)
  }

  const allShiftFirefighters =
    isReplacingLieutenant && shiftFirefighters && replacementFirefighterId
      ? [
          ...shiftFirefighters.filter((f) => f.role !== "lieutenant"),
          {
            id: replacementFirefighterId,
            first_name: firefighterName?.split(" ")[0] || "",
            last_name: firefighterName?.split(" ").slice(1).join(" ") || "",
            role: "firefighter",
          },
        ].filter(Boolean)
      : []

  return (
    <>
      <Button
        onClick={handleApprove}
        disabled={isLoading}
        size="sm"
        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
      >
        {isLoading ? "Assignation..." : "Assigner"}
      </Button>

      <Dialog open={showLieutenantDialog} onOpenChange={setShowLieutenantDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Désigner le lieutenant</DialogTitle>
            <DialogDescription>Vous remplacez un lieutenant. Qui sera le lieutenant pour ce quart?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lieutenant">Lieutenant</Label>
              <Select value={selectedLieutenantId} onValueChange={setSelectedLieutenantId}>
                <SelectTrigger id="lieutenant">
                  <SelectValue placeholder={`Par défaut: ${firefighterName}`} />
                </SelectTrigger>
                <SelectContent>
                  {allShiftFirefighters.map((firefighter) => (
                    <SelectItem key={firefighter.id} value={firefighter.id.toString()}>
                      {firefighter.first_name} {firefighter.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Si aucun n'est sélectionné, {firefighterName} sera le lieutenant
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLieutenantDialog(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button onClick={handleLieutenantSelection} disabled={isLoading}>
              {isLoading ? "Assignation..." : "Assigner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
