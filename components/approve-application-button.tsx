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
import { setActingLieutenant, setActingCaptain } from "@/app/actions/shift-assignments"
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
  const [showRoleSelectionDialog, setShowRoleSelectionDialog] = useState(false)
  const [selectedLieutenantId, setSelectedLieutenantId] = useState<string>("")
  const [selectedCaptainId, setSelectedCaptainId] = useState<string>("")
  const router = useRouter()

  const isReplacingLieutenant = replacedFirefighterRole === "lieutenant"
  const isReplacingCaptain = replacedFirefighterRole === "captain"

  const handleApprove = async () => {
    if ((isReplacingLieutenant || isReplacingCaptain) && shiftFirefighters && shiftId && replacementFirefighterId) {
      if (isReplacingCaptain) {
        const permanentLieutenant = shiftFirefighters.find((f) => f.role === "lieutenant")
        if (permanentLieutenant) {
          setSelectedCaptainId(permanentLieutenant.id.toString())
        }
      }
      setShowRoleSelectionDialog(true)
      return
    }

    await performApproval()
  }

  const performApproval = async (captainId?: number, lieutenantId?: number) => {
    setIsLoading(true)
    const pathParts = window.location.pathname.split("/")
    const replacementId = Number.parseInt(pathParts[pathParts.length - 1])

    const result = await approveApplication(applicationId, replacementId)

    if (result.success && result.shiftId) {
      if (isReplacingCaptain && captainId) {
        console.log("[v0] Calling setActingCaptain with shiftId:", result.shiftId, "captainId:", captainId)
        await setActingCaptain(result.shiftId, captainId)
      }

      if ((isReplacingLieutenant || isReplacingCaptain) && lieutenantId) {
        console.log("[v0] Calling setActingLieutenant with shiftId:", result.shiftId, "lieutenantId:", lieutenantId)
        await setActingLieutenant(result.shiftId, lieutenantId)
      }

      toast.success("Pompier assigné avec succès")
      setShowRoleSelectionDialog(false)
      setSelectedLieutenantId("")
      setSelectedCaptainId("")
      router.refresh()
    } else {
      toast.error(result.error || "Erreur lors de l'assignation")
    }

    setIsLoading(false)
  }

  const handleRoleSelection = async () => {
    if (isReplacingCaptain) {
      const captainId = selectedCaptainId ? Number.parseInt(selectedCaptainId) : undefined
      const lieutenantId = selectedLieutenantId ? Number.parseInt(selectedLieutenantId) : undefined

      if (!captainId) {
        toast.error("Veuillez sélectionner un capitaine")
        return
      }

      if (!lieutenantId) {
        toast.error("Veuillez sélectionner un lieutenant")
        return
      }

      await performApproval(captainId, lieutenantId)
    } else if (isReplacingLieutenant) {
      const lieutenantId = selectedLieutenantId ? Number.parseInt(selectedLieutenantId) : replacementFirefighterId

      if (!lieutenantId) {
        toast.error("Veuillez sélectionner un lieutenant")
        return
      }

      await performApproval(undefined, lieutenantId)
    }
  }

  const allShiftFirefighters =
    (isReplacingLieutenant || isReplacingCaptain) && shiftFirefighters && replacementFirefighterId
      ? [
          ...shiftFirefighters.filter((f) => {
            // For captain replacement, exclude the captain from the list
            if (isReplacingCaptain) return f.role !== "captain"
            // For lieutenant replacement, exclude the lieutenant from the list
            if (isReplacingLieutenant) return f.role !== "lieutenant"
            return true
          }),
          {
            id: replacementFirefighterId,
            first_name: firefighterName?.split(" ")[0] || "",
            last_name: firefighterName?.split(" ").slice(1).join(" ") || "",
            role: "firefighter",
          },
        ].filter(Boolean)
      : []

  const permanentLieutenant = shiftFirefighters?.find((f) => f.role === "lieutenant")
  const defaultCaptainName = permanentLieutenant
    ? `${permanentLieutenant.first_name} ${permanentLieutenant.last_name}`
    : "Lieutenant permanent"

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

      <Dialog open={showRoleSelectionDialog} onOpenChange={setShowRoleSelectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isReplacingCaptain ? "Désigner le capitaine et le lieutenant" : "Désigner le lieutenant"}
            </DialogTitle>
            <DialogDescription>
              {isReplacingCaptain
                ? "Vous remplacez un capitaine. Qui sera le capitaine et le lieutenant pour ce quart?"
                : "Vous remplacez un lieutenant. Qui sera le lieutenant pour ce quart?"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isReplacingCaptain && (
              <div className="space-y-2">
                <Label htmlFor="captain">Capitaine</Label>
                <Select value={selectedCaptainId} onValueChange={setSelectedCaptainId}>
                  <SelectTrigger id="captain">
                    <SelectValue placeholder={`Par défaut: ${defaultCaptainName}`} />
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
                  Si aucun n'est sélectionné, {defaultCaptainName} sera le capitaine
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="lieutenant">Lieutenant</Label>
              <Select value={selectedLieutenantId} onValueChange={setSelectedLieutenantId}>
                <SelectTrigger id="lieutenant">
                  <SelectValue
                    placeholder={
                      isReplacingLieutenant ? `Par défaut: ${firefighterName}` : "Sélectionner un lieutenant"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {allShiftFirefighters.map((firefighter) => (
                    <SelectItem key={firefighter.id} value={firefighter.id.toString()}>
                      {firefighter.first_name} {firefighter.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isReplacingLieutenant && (
                <p className="text-xs text-muted-foreground">
                  Si aucun n'est sélectionné, {firefighterName} sera le lieutenant
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleSelectionDialog(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button onClick={handleRoleSelection} disabled={isLoading}>
              {isLoading ? "Assignation..." : "Assigner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
