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
import { createReplacementFromShift, getReplacementsForShift } from "@/app/actions/replacements"
import { useRouter } from "next/navigation"
import { getShiftTypeLabel, getShiftTypeColor, getTeamColor } from "@/lib/colors"
import { UserX } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getDefaultReplacementTimes } from "@/lib/shift-utils"

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
  }>
  leaves: Array<any>
  dateStr: string
}

type ReplacementData = {
  replacement_id: number
  user_id: number
  replacement_status: string
  is_partial?: boolean
  start_time?: string
  end_time?: string
  applications: Array<{
    id: number
    applicant_id: number
    first_name: string
    last_name: string
    status: string
    applied_at: string
  }>
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
}: ShiftAssignmentDrawerProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFirefighter, setSelectedFirefighter] = useState<{
    id: number
    first_name: string
    last_name: string
  } | null>(null)
  const [replacements, setReplacements] = useState<ReplacementData[]>([])
  const [loadingReplacements, setLoadingReplacements] = useState(false)
  const [isPartial, setIsPartial] = useState(false)
  const defaultTimes = shift ? getDefaultReplacementTimes(shift.shift_type) : { startTime: "07:00", endTime: "17:00" }
  const [startTime, setStartTime] = useState(defaultTimes.startTime)
  const [endTime, setEndTime] = useState(defaultTimes.endTime)

  useEffect(() => {
    if (open && shift) {
      const fetchReplacements = async () => {
        setLoadingReplacements(true)
        const shiftDate = shift.date.toISOString().split("T")[0]

        const data = await getReplacementsForShift(shiftDate, shift.shift_type, shift.team_id)

        setReplacements(data as ReplacementData[])
        setLoadingReplacements(false)
      }
      fetchReplacements()
    }
  }, [open, shift])

  if (!shift) return null

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
    setReplacements(data as ReplacementData[])

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

          <div className="mt-6 space-y-3">
            {teamFirefighters.map((firefighter) => {
              const replacement = getReplacementForFirefighter(firefighter.id)
              const hasReplacement = !!replacement

              const firefighterLeave = getFirefighterLeaveForDate(firefighter.id, shift.date, leaves)
              const hasPartialLeave = firefighterLeave && firefighterLeave.start_time && firefighterLeave.end_time

              const hasPartialReplacement = replacement?.is_partial && replacement?.start_time && replacement?.end_time

              return (
                <Card key={firefighter.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium">
                          {firefighter.first_name} {firefighter.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{firefighter.email}</p>
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
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs">
                              Remplacement partiel: {replacement.start_time!.slice(0, 5)} -{" "}
                              {replacement.end_time!.slice(0, 5)}
                            </Badge>
                          </div>
                        )}
                        {hasReplacement && replacement.applications.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium text-orange-600">
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
                        {hasReplacement && replacement.applications.length === 0 && (
                          <p className="text-xs text-orange-600 mt-2">Remplacement demandé (aucun candidat)</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleBadgeColor(firefighter.role)}>{getRoleLabel(firefighter.role)}</Badge>
                        {!hasReplacement && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedFirefighter(firefighter)}
                            disabled={isLoading || loadingReplacements}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            Remplacement
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {teamFirefighters.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Aucun pompier disponible dans cette équipe</p>
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
    </>
  )
}
