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
import { AlertTriangle } from "lucide-react"

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
  actualWeeklyHours?: number
  shiftType?: string
  teamPriorityCandidates?: Array<{
    user_id: number
    first_name: string
    last_name: string
    team_rank: number
  }>
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
  actualWeeklyHours = 0,
  shiftType,
  teamPriorityCandidates = [],
}: ApproveApplicationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showRoleSelectionDialog, setShowRoleSelectionDialog] = useState(false)
  const [showOvertimeWarning, setShowOvertimeWarning] = useState(false)
  const [selectedLieutenantId, setSelectedLieutenantId] = useState<string>("")
  const [selectedCaptainId, setSelectedCaptainId] = useState<string>("")
  const router = useRouter()

  const isReplacingLieutenant = replacedFirefighterRole === "lieutenant"
  const isReplacingCaptain = replacedFirefighterRole === "captain"

  const calculateReplacementHours = () => {
    if (isPartial && startTime && endTime) {
      const [startHour, startMin] = startTime.split(":").map(Number)
      const [endHour, endMin] = endTime.split(":").map(Number)
      return endHour - startHour + (endMin - startMin) / 60
    }

    switch (shiftType) {
      case "day":
        return 10
      case "night":
        return 14
      case "full_24h":
        return 24
      default:
        return 0
    }
  }

  const handleApprove = async () => {
    const replacementHours = calculateReplacementHours()
    const totalHours = actualWeeklyHours + replacementHours

    if (totalHours > 42) {
      setShowOvertimeWarning(true)
      return
    }

    if ((isReplacingLieutenant || isReplacingCaptain) && shiftFirefighters && shiftId && replacementFirefighterId) {
      if (isReplacingCaptain) {
        const permanentLieutenant = shiftFirefighters.find((f) => f.role === "lieutenant")
        if (permanentLieutenant) {
          setSelectedCaptainId(permanentLieutenant.id.toString())
        }
      }

      if (isReplacingLieutenant && teamPriorityCandidates.length > 0) {
        const sortedByRank = [...teamPriorityCandidates].sort((a, b) => (a.team_rank || 999) - (b.team_rank || 999))
        const bestCandidate = sortedByRank[0]
        setSelectedLieutenantId(bestCandidate.user_id.toString())
        console.log(
          "[v0] Auto-selected team priority candidate for lieutenant:",
          bestCandidate.first_name,
          bestCandidate.last_name,
          "with rank",
          bestCandidate.team_rank,
        )
      }

      setShowRoleSelectionDialog(true)
      return
    }

    await performApproval()
  }

  const handleOvertimeConfirm = async () => {
    setShowOvertimeWarning(false)

    if ((isReplacingLieutenant || isReplacingCaptain) && shiftFirefighters && shiftId && replacementFirefighterId) {
      if (isReplacingCaptain) {
        const permanentLieutenant = shiftFirefighters.find((f) => f.role === "lieutenant")
        if (permanentLieutenant) {
          setSelectedCaptainId(permanentLieutenant.id.toString())
        }
      }

      if (isReplacingLieutenant && teamPriorityCandidates.length > 0) {
        const sortedByRank = [...teamPriorityCandidates].sort((a, b) => (a.team_rank || 999) - (b.team_rank || 999))
        const bestCandidate = sortedByRank[0]
        setSelectedLieutenantId(bestCandidate.user_id.toString())
        console.log(
          "[v0] Auto-selected team priority candidate for lieutenant after overtime:",
          bestCandidate.first_name,
          bestCandidate.last_name,
          "with rank",
          bestCandidate.team_rank,
        )
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
            if (isReplacingCaptain) return f.role !== "captain"
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

  const sortedShiftFirefighters = [...allShiftFirefighters].sort((a, b) => a.last_name.localeCompare(b.last_name, "fr"))

  const permanentLieutenant = shiftFirefighters?.find((f) => f.role === "lieutenant")
  const defaultCaptainName = permanentLieutenant
    ? `${permanentLieutenant.last_name} ${permanentLieutenant.first_name}`
    : "Lieutenant permanent"

  const sortedTeamPriorityCandidates = [...teamPriorityCandidates].sort(
    (a, b) => (a.team_rank || 999) - (b.team_rank || 999),
  )

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

      <Dialog open={showOvertimeWarning} onOpenChange={setShowOvertimeWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Dépassement de 42 heures
            </DialogTitle>
            <div className="text-muted-foreground text-sm space-y-2 pt-2">
              <p>
                <strong>{firefighterName}</strong> a actuellement <strong>{actualWeeklyHours}h</strong> planifiées cette
                semaine.
              </p>
              <p>
                Ce remplacement ajoute <strong>{calculateReplacementHours()}h</strong>, pour un total de{" "}
                <strong className="text-amber-600">{actualWeeklyHours + calculateReplacementHours()}h</strong> dans la
                semaine.
              </p>
              <p className="text-foreground font-medium pt-2">Voulez-vous quand même assigner ce pompier?</p>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOvertimeWarning(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button onClick={handleOvertimeConfirm} disabled={isLoading} className="bg-amber-600 hover:bg-amber-700">
              Assigner quand même
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    {sortedShiftFirefighters.map((firefighter) => (
                      <SelectItem key={firefighter.id} value={firefighter.id.toString()}>
                        {firefighter.last_name} {firefighter.first_name}
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
                      isReplacingLieutenant && sortedTeamPriorityCandidates.length > 0
                        ? `Par défaut: ${sortedTeamPriorityCandidates[0].last_name} ${sortedTeamPriorityCandidates[0].first_name} (priorité équipe)`
                        : isReplacingLieutenant
                          ? `Par défaut: ${firefighterName}`
                          : "Sélectionner un lieutenant"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {sortedTeamPriorityCandidates.length > 0 && (
                    <>
                      {sortedTeamPriorityCandidates.map((candidate) => (
                        <SelectItem key={candidate.user_id} value={candidate.user_id.toString()}>
                          {candidate.last_name} {candidate.first_name}{" "}
                          <span className="text-muted-foreground text-xs">
                            (priorité équipe - rang {candidate.team_rank})
                          </span>
                        </SelectItem>
                      ))}
                      <SelectItem disabled value="separator">
                        ──────────
                      </SelectItem>
                    </>
                  )}
                  {sortedShiftFirefighters.map((firefighter) => (
                    <SelectItem key={firefighter.id} value={firefighter.id.toString()}>
                      {firefighter.last_name} {firefighter.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isReplacingLieutenant && (
                <p className="text-xs text-muted-foreground">
                  {sortedTeamPriorityCandidates.length > 0
                    ? `Par défaut, ${sortedTeamPriorityCandidates[0].last_name} ${sortedTeamPriorityCandidates[0].first_name} (priorité équipe) sera le lieutenant`
                    : `Si aucun n'est sélectionné, ${firefighterName} sera le lieutenant`}
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
