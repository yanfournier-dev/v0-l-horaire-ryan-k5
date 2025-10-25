"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  createReplacementFromShift,
  getReplacementsForShift,
  createExtraFirefighterReplacement,
  removeReplacementAssignment,
} from "@/app/actions/replacements"
import {
  addExtraFirefighterToShift,
  getAllFirefighters,
  removeFirefighterFromShift,
} from "@/app/actions/shift-assignments"
import { useRouter } from "next/navigation"
import { getShiftTypeLabel, getShiftTypeColor, getTeamColor } from "@/lib/colors"
import { UserPlus, Trash2, Users, UserX } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getDefaultReplacementTimes } from "@/lib/shift-utils"
import { ApplyForReplacementButton } from "@/components/apply-for-replacement-button"
import { DeleteReplacementButton } from "@/components/delete-replacement-button"

interface ShiftAssignmentDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift: {
    id: number
    cycle_day: number
    shift_type: string
    start_time: string
    end_time: string
    team_name: string
    team_color?: string
    team_id: number
    date: Date
    exchanges?: Array<any> // Add exchanges to shift type
  } | null
  teamFirefighters: Array<{
    id: number
    first_name: string
    last_name: string
    role: string
    email: string
  }>
  currentAssignments: Array<{
    id: number
    user_id: number
    first_name: string
    last_name: string
    role: string
    is_extra?: boolean
    is_partial?: boolean
    start_time?: string
    end_time?: string
  }>
  leaves: Array<any>
  dateStr: string
  isAdmin?: boolean
  currentUserId?: number
}

function getFirefighterLeaveForDate(firefighterId: number, date: Date, leaves: Array<any>) {
  return leaves.find(
    (leave: any) =>
      leave.user_id === firefighterId && new Date(leave.start_date) <= date && new Date(leave.end_date) >= date,
  )
}

export function ShiftAssignmentDrawer({
  open,
  onOpenChange,
  shift,
  teamFirefighters,
  leaves,
  dateStr,
  currentAssignments,
  isAdmin = false,
  currentUserId,
}: ShiftAssignmentDrawerProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFirefighter, setSelectedFirefighter] = useState<{
    id: number
    first_name: string
    last_name: string
  } | null>(null)
  const [replacements, setReplacements] = useState<any[]>([])
  const [loadingReplacements, setLoadingReplacements] = useState(false)
  const [isPartial, setIsPartial] = useState(false)
  const defaultTimes = shift ? getDefaultReplacementTimes(shift.shift_type) : { startTime: "07:00", endTime: "17:00" }
  const [startTime, setStartTime] = useState(defaultTimes.startTime)
  const [endTime, setEndTime] = useState(defaultTimes.endTime)
  const [showExtraDialog, setShowExtraDialog] = useState(false)
  const [isCreatingRequest, setIsCreatingRequest] = useState(false)
  const [selectedExtraFirefighter, setSelectedExtraFirefighter] = useState<number | string | null>(null)
  const [allFirefighters, setAllFirefighters] = useState<any[]>([])
  const [isExtraPartial, setIsExtraPartial] = useState(false)
  const [extraStartTime, setExtraStartTime] = useState(defaultTimes.startTime)
  const [extraEndTime, setExtraEndTime] = useState(defaultTimes.endTime)
  const [extraFirefighters, setExtraFirefighters] = useState<number[]>([])
  const [removedExtraFirefighters, setRemovedExtraFirefighters] = useState<number[]>([]) // Track removed extra firefighters by user_id to hide them immediately

  useEffect(() => {
    if (open && shift) {
      const fetchReplacements = async () => {
        setLoadingReplacements(true)
        const shiftDate = shift.date.toISOString().split("T")[0]

        const data = await getReplacementsForShift(shiftDate, shift.shift_type, shift.team_id)

        setReplacements(data)
        setLoadingReplacements(false)
      }
      fetchReplacements()

      const fetchAllFirefighters = async () => {
        const firefighters = await getAllFirefighters()
        setAllFirefighters(firefighters)
      }
      fetchAllFirefighters()
    }
  }, [open, shift])

  if (!shift) return null

  const refreshReplacements = async () => {
    setLoadingReplacements(true)
    const shiftDate = shift.date.toISOString().split("T")[0]
    const data = await getReplacementsForShift(shiftDate, shift.shift_type, shift.team_id)
    setReplacements(data)
    setLoadingReplacements(false)
  }

  const handleCreateReplacement = async () => {
    if (!selectedFirefighter || isLoading) return

    if (isPartial && startTime >= endTime) {
      toast.error("L'heure de début doit être avant l'heure de fin")
      return
    }

    setIsLoading(true)

    const shiftDate = shift.date.toISOString().split("T")[0]
    const result = await createReplacementFromShift(
      selectedFirefighter.id,
      shiftDate,
      shift.shift_type,
      shift.team_id,
      isPartial,
      isPartial ? startTime : undefined,
      isPartial ? endTime : undefined,
    )

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success("Demande de remplacement créée avec succès")

    const data = await getReplacementsForShift(shiftDate, shift.shift_type, shift.team_id)
    setReplacements(data)

    setIsLoading(false)
    setSelectedFirefighter(null)
    setIsPartial(false)
    const times = getDefaultReplacementTimes(shift.shift_type)
    setStartTime(times.startTime)
    setEndTime(times.endTime)

    router.refresh()
  }

  const handleCancel = () => {
    setSelectedFirefighter(null)
    setIsPartial(false)
    const times = getDefaultReplacementTimes(shift.shift_type)
    setStartTime(times.startTime)
    setEndTime(times.endTime)
  }

  const getReplacementForFirefighter = (firefighterId: number) => {
    return replacements.find((r) => r.user_id === firefighterId)
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "captain":
        return "Capitaine"
      case "lieutenant":
        return "Lieutenant"
      case "firefighter":
        return "Pompier"
      default:
        return role
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "captain":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      case "lieutenant":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "En attente"
      case "approved":
        return "Approuvé"
      case "rejected":
        return "Rejeté"
      default:
        return status
    }
  }

  const generateTimeOptions = () => {
    const times = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
        times.push(timeString)
      }
    }
    return times
  }

  const handleAddExtraFirefighter = async () => {
    if (selectedExtraFirefighter === "request") {
      await handleCreateExtraRequest()
      return
    }

    if (!selectedExtraFirefighter || isLoading) return

    if (isExtraPartial && extraStartTime >= extraEndTime) {
      toast.error("L'heure de début doit être avant l'heure de fin")
      return
    }

    setIsLoading(true)

    const result = await addExtraFirefighterToShift(
      shift.id,
      Number(selectedExtraFirefighter),
      isExtraPartial,
      isExtraPartial ? extraStartTime : undefined,
      isExtraPartial ? extraEndTime : undefined,
    )

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success("Pompier supplémentaire ajouté avec succès")

    setIsLoading(false)
    setShowExtraDialog(false)
    setSelectedExtraFirefighter(null)
    setIsCreatingRequest(false)
    setIsExtraPartial(false)
    const times = getDefaultReplacementTimes(shift.shift_type)
    setExtraStartTime(times.startTime)
    setExtraEndTime(times.endTime)

    router.refresh()
  }

  const handleCreateExtraRequest = async () => {
    if (isLoading) return

    if (isExtraPartial && extraStartTime >= extraEndTime) {
      toast.error("L'heure de début doit être avant l'heure de fin")
      return
    }

    setIsLoading(true)

    const shiftDate = shift.date.toISOString().split("T")[0]

    const result = await createExtraFirefighterReplacement(
      shiftDate,
      shift.shift_type,
      shift.team_id,
      isExtraPartial,
      isExtraPartial ? extraStartTime : undefined,
      isExtraPartial ? extraEndTime : undefined,
    )

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success("Demande de pompier supplémentaire créée avec succès")

    setIsLoading(false)
    setShowExtraDialog(false)
    setSelectedExtraFirefighter(null)
    setIsCreatingRequest(false)
    setIsExtraPartial(false)
    const times = getDefaultReplacementTimes(shift.shift_type)
    setExtraStartTime(times.startTime)
    setExtraEndTime(times.endTime)

    router.refresh()
  }

  const handleRemoveExtraFirefighter = async (userId: number, firefighterName: string) => {
    setIsLoading(true)

    const result = await removeFirefighterFromShift(shift.id, userId)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success("Pompier supplémentaire retiré avec succès")

    setRemovedExtraFirefighters((prev) => [...prev, userId])

    setIsLoading(false)
    router.refresh()
  }

  const handleRemoveReplacementAssignment = async (replacementId: number, replacementName: string) => {
    setIsLoading(true)

    const result = await removeReplacementAssignment(replacementId)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success(`${replacementName} a été retiré du remplacement`)

    // Refresh replacements list
    const shiftDate = shift.date.toISOString().split("T")[0]
    const data = await getReplacementsForShift(shiftDate, shift.shift_type, shift.team_id)
    setReplacements(data)

    setIsLoading(false)
    router.refresh()
  }

  const availableFirefighters = [...allFirefighters].sort((a, b) => {
    const lastNameCompare = a.last_name.localeCompare(b.last_name, "fr")
    if (lastNameCompare !== 0) return lastNameCompare
    return a.first_name.localeCompare(b.first_name, "fr")
  })

  const displayedAssignments = currentAssignments.filter((a) => !removedExtraFirefighters.includes(a.user_id))

  const getExchangeForFirefighter = (firefighterId: number, firstName: string, lastName: string, role: string) => {
    if (!shift?.exchanges) return null

    return shift.exchanges.find((ex: any) => {
      if (ex.type === "requester") {
        // This is the requester's original shift, so target is taking their place
        return (
          ex.requester_first_name === firstName && ex.requester_last_name === lastName && ex.requester_role === role
        )
      } else {
        // This is the target's original shift, so requester is taking their place
        return ex.target_first_name === firstName && ex.target_last_name === lastName && ex.target_role === role
      }
    })
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Pompiers assignés au quart</SheetTitle>
            <SheetDescription>
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2">
                  <Badge className={getTeamColor(shift.team_name, shift.team_color)}>{shift.team_name}</Badge>
                  <Badge className={getShiftTypeColor(shift.shift_type)}>{getShiftTypeLabel(shift.shift_type)}</Badge>
                </div>
                <div className="text-sm">
                  Jour {shift.cycle_day} • {shift.date.toLocaleDateString("fr-CA")}
                </div>
                <div className="text-sm">
                  {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                </div>
                <div className="text-sm font-medium">{teamFirefighters.length} pompiers</div>
              </div>
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4">
            <Button
              onClick={() => setShowExtraDialog(true)}
              disabled={isLoading || loadingReplacements}
              className="w-full bg-green-600 hover:bg-green-700"
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Ajouter un pompier supplémentaire
            </Button>
          </div>

          <div className="mt-6 space-y-3">
            {displayedAssignments.map((assignment) => {
              const replacement = getReplacementForFirefighter(assignment.user_id)
              const hasReplacement = !!replacement

              const firefighterLeave = getFirefighterLeaveForDate(assignment.user_id, shift.date, leaves)
              const hasPartialLeave = firefighterLeave && firefighterLeave.start_time && firefighterLeave.end_time

              const hasPartialReplacement = replacement?.is_partial && replacement?.start_time && replacement?.end_time

              const isExtraRequest = assignment.first_name === "Pompier" && assignment.last_name === "supplémentaire"

              const exchange = getExchangeForFirefighter(
                assignment.user_id,
                assignment.first_name,
                assignment.last_name,
                assignment.role,
              )
              const hasExchange = !!exchange

              const displayName = isExtraRequest
                ? "Pompier supplémentaire"
                : `${assignment.first_name} ${assignment.last_name}`

              let exchangePartner = null
              let exchangePartialTimes = null

              if (hasExchange) {
                if (exchange.type === "requester") {
                  // Target is taking requester's place
                  exchangePartner = `${exchange.target_first_name} ${exchange.target_last_name}`
                  if (exchange.is_partial && exchange.requester_start_time && exchange.requester_end_time) {
                    exchangePartialTimes = `${exchange.requester_start_time.slice(0, 5)}-${exchange.requester_end_time.slice(0, 5)}`
                  }
                } else {
                  // Requester is taking target's place
                  exchangePartner = `${exchange.requester_first_name} ${exchange.requester_last_name}`
                  if (exchange.is_partial && exchange.target_start_time && exchange.target_end_time) {
                    exchangePartialTimes = `${exchange.target_start_time.slice(0, 5)}-${exchange.target_end_time.slice(0, 5)}`
                  }
                }
              }

              const isReplacementAssigned = replacement?.status === "assigned"
              const assignedApplication = replacement?.applications?.find((app: any) => app.status === "approved")
              const assignedFirefighterName = assignedApplication
                ? `${assignedApplication.first_name} ${assignedApplication.last_name}`
                : null

              return (
                <Card
                  key={assignment.id}
                  className={
                    assignment.is_extra
                      ? "border-amber-300 bg-amber-50/30"
                      : hasExchange
                        ? "border-purple-300 bg-purple-50/30"
                        : ""
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{displayName}</p>
                          {assignment.is_extra && !isExtraRequest && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">
                              Supplémentaire
                            </Badge>
                          )}
                          {isExtraRequest && (
                            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">
                              Demande en cours
                            </Badge>
                          )}
                          {assignment.is_extra &&
                            assignment.is_partial &&
                            assignment.start_time &&
                            assignment.end_time && (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">
                                Partiel: {assignment.start_time.slice(0, 5)} - {assignment.end_time.slice(0, 5)}
                              </Badge>
                            )}
                        </div>
                        {!isExtraRequest && assignment.email && (
                          <p className="text-xs text-muted-foreground">{assignment.email}</p>
                        )}
                        {hasExchange && (
                          <div className="mt-2">
                            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">
                              ↔ Échange avec {exchangePartner}
                              {exchangePartialTimes && ` (${exchangePartialTimes})`}
                            </Badge>
                          </div>
                        )}
                        {hasPartialLeave && (
                          <div className="mt-2">
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                              Congé partiel: {firefighterLeave.start_time.slice(0, 5)} -{" "}
                              {firefighterLeave.end_time.slice(0, 5)}
                            </Badge>
                          </div>
                        )}
                        {hasPartialReplacement && (
                          <div className="mt-2">
                            <Badge
                              className={`${
                                replacement.status === "assigned"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : replacement.status === "pending"
                                    ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              } text-xs`}
                            >
                              {replacement.status === "assigned" ? (
                                <span className="text-green-700 mr-1">✓</span>
                              ) : replacement.status === "pending" ? (
                                <span className="mr-1">?</span>
                              ) : (
                                <span className="mr-1">⏳</span>
                              )}
                              Remplacement partiel: {replacement.start_time!.slice(0, 5)} -{" "}
                              {replacement.end_time!.slice(0, 5)}
                            </Badge>
                          </div>
                        )}
                        {isReplacementAssigned && assignedFirefighterName && (
                          <div className="mt-2 flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                              <span className="text-green-700 mr-1">✓</span>
                              Remplacé par {assignedFirefighterName}
                            </Badge>
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleRemoveReplacementAssignment(replacement.id, assignedFirefighterName)
                                }
                                disabled={isLoading || loadingReplacements}
                                className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                        {hasReplacement && replacement.applications.length > 0 && !isReplacementAssigned && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              Remplacement demandé ({replacement.applications.length}{" "}
                              {replacement.applications.length === 1 ? "candidat" : "candidats"})
                            </p>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {replacement.applications.map((app) => (
                                <div key={app.id} className="flex items-center gap-1">
                                  <span>
                                    • {app.first_name} {app.last_name}
                                  </span>
                                  <span className="text-[10px]">({getStatusLabel(app.status)})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {hasReplacement && replacement.applications.length === 0 && !isReplacementAssigned && (
                          <p className="text-xs text-gray-700 dark:text-gray-300 mt-2">
                            Remplacement demandé (aucun candidat)
                          </p>
                        )}
                        {hasReplacement && (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {!isReplacementAssigned && (
                              <ApplyForReplacementButton
                                replacementId={replacement.id}
                                isAdmin={isAdmin}
                                firefighters={allFirefighters}
                                onSuccess={refreshReplacements}
                              />
                            )}
                            {isAdmin && replacement.applications.length > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  router.push(`/dashboard/replacements/${replacement.id}`)
                                }}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Users className="h-4 w-4 mr-1" />
                                Voir les candidats
                              </Button>
                            )}
                            {isAdmin && <DeleteReplacementButton replacementId={replacement.id} />}
                          </div>
                        )}
                        {!hasReplacement && !assignment.is_extra && !isExtraRequest && isAdmin && (
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedFirefighter({
                                  id: assignment.user_id,
                                  first_name: assignment.first_name,
                                  last_name: assignment.last_name,
                                })
                              }}
                              disabled={isLoading || loadingReplacements}
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Remplacement
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleBadgeColor(assignment.role)}>{getRoleLabel(assignment.role)}</Badge>
                        {assignment.is_extra && !isExtraRequest && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveExtraFirefighter(assignment.user_id, displayName)}
                            disabled={isLoading || loadingReplacements}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {displayedAssignments.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Aucun pompier assigné à ce quart</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="mt-6">
            <Button onClick={() => onOpenChange(false)} className="w-full bg-red-600 hover:bg-red-700">
              Fermer
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!selectedFirefighter}>
        <AlertDialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Créer une demande de remplacement</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous créer une demande de remplacement pour{" "}
              <span className="font-semibold">
                {selectedFirefighter?.first_name} {selectedFirefighter?.last_name}
              </span>{" "}
              pour le quart du {shift.date.toLocaleDateString("fr-CA")} ({getShiftTypeLabel(shift.shift_type)}) ?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="partial"
                checked={isPartial}
                onCheckedChange={(checked) => {
                  setIsPartial(checked === true)
                }}
              />
              <Label
                htmlFor="partial"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Remplacement partiel
              </Label>
            </div>

            {isPartial && (
              <div className="space-y-3 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="start-time" className="text-sm">
                    Heure de début
                  </Label>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger id="start-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateTimeOptions().map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-time" className="text-sm">
                    Heure de fin
                  </Label>
                  <Select value={endTime} onValueChange={setEndTime}>
                    <SelectTrigger id="end-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateTimeOptions().map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
              Annuler
            </Button>
            <AlertDialogAction
              onClick={handleCreateReplacement}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? "Création..." : "Créer la demande"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showExtraDialog} onOpenChange={setShowExtraDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ajouter un pompier supplémentaire</AlertDialogTitle>
            <AlertDialogDescription>
              Sélectionnez un pompier à ajouter comme supplémentaire pour ce quart, ou créez une demande de remplacement
              disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <Select
              value={selectedExtraFirefighter?.toString() || ""}
              onValueChange={(value) => {
                setSelectedExtraFirefighter(value === "request" ? "request" : Number.parseInt(value))
                setIsCreatingRequest(value === "request")
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="request" className="font-semibold text-orange-600">
                  Créer une demande de remplacement disponible
                </SelectItem>
                {availableFirefighters.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Ou assigner directement:
                    </div>
                    {availableFirefighters.map((ff) => (
                      <SelectItem key={ff.id} value={ff.id.toString()}>
                        {ff.first_name} {ff.last_name}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="extra-partial"
                checked={isExtraPartial}
                onCheckedChange={(checked) => {
                  setIsExtraPartial(checked === true)
                }}
              />
              <Label
                htmlFor="extra-partial"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Remplacement partiel
              </Label>
            </div>

            {isExtraPartial && (
              <div className="space-y-3 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="extra-start-time" className="text-sm">
                    Heure de début
                  </Label>
                  <Select value={extraStartTime} onValueChange={setExtraStartTime}>
                    <SelectTrigger id="extra-start-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateTimeOptions().map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="extra-end-time" className="text-sm">
                    Heure de fin
                  </Label>
                  <Select value={extraEndTime} onValueChange={setExtraEndTime}>
                    <SelectTrigger id="extra-end-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateTimeOptions().map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowExtraDialog(false)
                setSelectedExtraFirefighter(null)
                setIsCreatingRequest(false)
                setIsExtraPartial(false)
                const times = getDefaultReplacementTimes(shift.shift_type)
                setExtraStartTime(times.startTime)
                setExtraEndTime(times.endTime)
              }}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <AlertDialogAction
              onClick={handleAddExtraFirefighter}
              disabled={isLoading || !selectedExtraFirefighter}
              className={isCreatingRequest ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}
            >
              {isLoading
                ? isCreatingRequest
                  ? "Création..."
                  : "Ajout..."
                : isCreatingRequest
                  ? "Créer la demande"
                  : "Ajouter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
