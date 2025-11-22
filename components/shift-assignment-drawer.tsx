"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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
  // removeReplacement, // Moved import
} from "@/app/actions/replacements"
import {
  addExtraFirefighterToShift,
  getAllFirefighters,
  removeFirefighterFromShift,
  setActingLieutenant,
  removeActingLieutenant,
  setActingCaptain,
  removeActingCaptain,
} from "@/app/actions/shift-assignments"
import {
  removeDirectAssignment,
  removeReplacement, // Added import from direct-assignments
} from "@/app/actions/direct-assignments"
import { useRouter } from "next/navigation"
import { getShiftTypeLabel, getShiftTypeColor, getTeamColor } from "@/lib/colors"
import { UserPlus, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getDefaultReplacementTimes } from "@/lib/shift-utils"
import { ApplyForReplacementButton } from "@/components/apply-for-replacement-button"
import { DeleteReplacementButton } from "@/components/delete-replacement-button"
import { DeadlineSelect } from "@/components/deadline-select"
import { formatDateForDB } from "@/lib/date-utils"
import { calculateAutoDeadline } from "@/lib/date-utils"
import { DirectAssignmentDialog } from "@/components/direct-assignment-dialog"
import { AddSecondReplacementDialog } from "@/components/add-second-replacement-dialog" // Added import

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
    position_code?: string // Added for sorting
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
    is_acting_lieutenant?: boolean
    showsLtBadge?: boolean // Add showsLtBadge field
    is_acting_captain?: boolean // Add is_acting_captain field
    is_direct_assignment?: boolean // Add is_direct_assignment field
    replaced_user_id?: number // Added for direct assignments
    replaced_name?: string // Added for direct assignments
    replacement_order?: number // Added for direct assignments and replacements
    is_replacement?: boolean // Added to differentiate replacements from direct assignments
  }>
  leaves: Array<any>
  dateStr: string
  isAdmin?: boolean
  currentUserId?: number
  onReplacementCreated?: () => void
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
  onReplacementCreated,
}: ShiftAssignmentDrawerProps) {
  const router = useRouter() // Added missing import

  const [isLoading, setIsLoading] = useState(false)
  const [selectedFirefighter, setSelectedFirefighter] = useState<{
    id: number
    first_name: string
    last_name: string
    position_code?: string // Added for sorting
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
  const [removedExtraFirefighters, setRemovedExtraFirefighters] = useState<number[]>([])
  const [deadlineSeconds, setDeadlineSeconds] = useState<number | null>(null)
  const [extraDeadlineSeconds, setExtraDeadlineSeconds] = useState<number | null>(null)
  const [showDeadlineWarning, setShowDeadlineWarning] = useState(false)
  const [showExtraDeadlineWarning, setShowExtraDeadlineWarning] = useState(false)
  const [assignedReplacements, setAssignedReplacements] = useState<any[]>([])
  const [showDirectAssignmentDialog, setShowDirectAssignmentDialog] = useState(false)
  const [showSecondReplacementDialog, setShowSecondReplacementDialog] = useState(false) // Added
  const [selectedReplacementForSecond, setSelectedReplacementForSecond] = useState<{
    // Added
    replacedFirefighter: { id: number; first_name: string; last_name: string }
    firstReplacementUserId: number
  } | null>(null)

  useEffect(() => {
    if (open && shift) {
      // console.log("[v0] ShiftAssignmentDrawer opened")
      // console.log("[v0] teamFirefighters:", teamFirefighters)
      // console.log("[v0] currentAssignments:", currentAssignments)
      // console.log("[v0] shift:", shift)
    }
  }, [open, shift, teamFirefighters, currentAssignments])

  const refreshAndClose = useCallback(() => {
    // Just close the drawer
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    if (open) {
      const fetchReplacements = async () => {
        setLoadingReplacements(true)
        const shiftDate = formatDateForDB(shift.date)

        const data = await getReplacementsForShift(shiftDate, shift.shift_type, shift.team_id)

        setReplacements(data)

        const assigned = data.filter(
          (r: any) => r.status === "assigned" && r.applications?.some((app: any) => app.status === "approved"),
        )

        const assignedWithAssignments = await Promise.all(
          assigned.map(async (r: any) => {
            const approvedApp = r.applications.find((app: any) => app.status === "approved")

            // Fetch shift_assignments for this replacement firefighter
            const assignmentResult = await fetch("/api/get-shift-assignment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                shiftId: shift.id,
                userId: approvedApp.applicant_id,
              }),
            })

            let isActingLieutenant = false
            let isActingCaptain = false

            if (assignmentResult.ok) {
              const assignmentData = await assignmentResult.json()
              isActingLieutenant = assignmentData.is_acting_lieutenant || false
              isActingCaptain = assignmentData.is_acting_captain || false
            }

            return {
              ...r,
              is_acting_lieutenant: isActingLieutenant,
              is_acting_captain: isActingCaptain,
            }
          }),
        )

        setAssignedReplacements(assignedWithAssignments)

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

  const refreshReplacements = async () => {
    setLoadingReplacements(true)
    const shiftDate = formatDateForDB(shift.date)
    const data = await getReplacementsForShift(shiftDate, shift.shift_type, shift.team_id)
    setReplacements(data)

    const assigned = data.filter(
      (r: any) => r.status === "assigned" && r.applications?.some((app: any) => app.status === "approved"),
    )

    const assignedWithAssignments = await Promise.all(
      assigned.map(async (r: any) => {
        const approvedApp = r.applications.find((app: any) => app.status === "approved")

        const assignmentResult = await fetch("/api/get-shift-assignment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shiftId: shift.id,
            userId: approvedApp.applicant_id,
          }),
        })

        let isActingLieutenant = false
        let isActingCaptain = false

        if (assignmentResult.ok) {
          const assignmentData = await assignmentResult.json()
          isActingLieutenant = assignmentData.is_acting_lieutenant || false
          isActingCaptain = assignmentData.is_acting_captain || false
        }

        return {
          ...r,
          is_acting_lieutenant: isActingLieutenant,
          is_acting_captain: isActingCaptain,
        }
      }),
    )

    setAssignedReplacements(assignedWithAssignments)

    setLoadingReplacements(false)
  }

  const handleCreateReplacement = async () => {
    if (typeof window !== "undefined") {
      const scrollPos = window.scrollY
      console.log("[v0] Drawer - saving scroll at start of handleCreateReplacement:", scrollPos)
      sessionStorage.setItem("calendar-scroll-position", scrollPos.toString())
      sessionStorage.setItem("skip-scroll-to-today", "true")
    }

    if (!selectedFirefighter || isLoading) return

    if (isPartial && startTime >= endTime) {
      toast.error("L'heure de début doit être avant l'heure de fin")
      return
    }

    if (!deadlineSeconds || deadlineSeconds === 0) {
      const shiftDate = formatDateForDB(shift.date)
      const autoDeadline = calculateAutoDeadline(shiftDate)
      const now = new Date()

      if (autoDeadline < now) {
        setShowDeadlineWarning(true)
        return
      }
    }

    setIsLoading(true)

    const shiftDate = formatDateForDB(shift.date)
    const result = await createReplacementFromShift(
      selectedFirefighter.id,
      shiftDate,
      shift.shift_type,
      shift.team_id,
      isPartial,
      isPartial ? startTime : undefined,
      isPartial ? endTime : undefined,
      deadlineSeconds ?? undefined,
      shift.start_time,
      shift.end_time,
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
    setDeadlineSeconds(null)
    setShowDeadlineWarning(false)
    const times = getDefaultReplacementTimes(shift.shift_type)
    setStartTime(times.startTime)
    setEndTime(times.endTime)

    if (onReplacementCreated) {
      onReplacementCreated()
    }

    refreshAndClose()
  }

  const handleCancel = () => {
    setSelectedFirefighter(null)
    setIsPartial(false)
    setDeadlineSeconds(null)
    setShowDeadlineWarning(false)
    const times = getDefaultReplacementTimes(shift.shift_type)
    setStartTime(times.startTime)
    setEndTime(times.endTime)
  }

  const getReplacementForFirefighter = (firefighterId: number | undefined) => {
    if (!firefighterId) return null
    const found = replacements.find((r) => r.user_id === firefighterId)
    return found || null
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
    setExtraDeadlineSeconds(null)
    const times = getDefaultReplacementTimes(shift.shift_type)
    setExtraStartTime(times.startTime)
    setExtraEndTime(times.endTime)

    refreshAndClose()
  }

  const handleCreateExtraRequest = async () => {
    if (isLoading) return

    if (isExtraPartial && extraStartTime >= extraEndTime) {
      toast.error("L'heure de début doit être avant l'heure de fin")
      return
    }

    if (!extraDeadlineSeconds || extraDeadlineSeconds === 0) {
      const shiftDate = formatDateForDB(shift.date)
      const autoDeadline = calculateAutoDeadline(shiftDate)
      const now = new Date()

      if (autoDeadline < now) {
        setShowExtraDeadlineWarning(true)
        return
      }
    }

    await executeCreateExtraRequest()
  }

  const executeCreateExtraRequest = async () => {
    setIsLoading(true)

    const shiftDate = formatDateForDB(shift.date)

    const result = await createExtraFirefighterReplacement(
      shiftDate,
      shift.shift_type,
      shift.team_id,
      isExtraPartial,
      isExtraPartial ? extraStartTime : undefined,
      isExtraPartial ? extraEndTime : undefined,
      extraDeadlineSeconds ?? undefined,
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
    setExtraDeadlineSeconds(null)
    setShowExtraDeadlineWarning(false)
    const times = getDefaultReplacementTimes(shift.shift_type)
    setExtraStartTime(times.startTime)
    setExtraEndTime(times.endTime)

    refreshAndClose()
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
    refreshAndClose()
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
    const shiftDate = formatDateForDB(shift.date)
    const data = await getReplacementsForShift(shiftDate, shift.shift_type, shift.team_id)
    setReplacements(data)

    setIsLoading(false)
    refreshAndClose()
  }

  const handleRemoveDirectAssignment = async (userId: number, firefighterName: string) => {
    setIsLoading(true)

    const result = await removeDirectAssignment(shift.id, userId)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success(`${firefighterName} a été retiré de l'assignation directe`)

    setIsLoading(false)
    refreshAndClose()
  }

  const handleSetLieutenant = async (userId: number, firefighterName: string) => {
    if (!shift) return

    setIsLoading(true)

    const result = await setActingLieutenant(shift.id, userId)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success(`${firefighterName} a été désigné comme lieutenant`)

    setIsLoading(false)
    refreshAndClose()
  }

  const handleRemoveLieutenant = async (userId: number, firefighterName: string) => {
    if (!shift) return

    setIsLoading(true)

    const result = await removeActingLieutenant(shift.id, userId)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success(`${firefighterName} n'est plus désigné comme lieutenant`)

    setIsLoading(false)
    refreshAndClose()
  }

  const handleSetCaptain = async (userId: number, firefighterName: string) => {
    if (!shift) return

    setIsLoading(true)

    const result = await setActingCaptain(shift.id, userId)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success(`${firefighterName} a été désigné comme capitaine`)

    setIsLoading(false)
    refreshAndClose()
  }

  const handleRemoveCaptain = async (userId: number, firefighterName: string) => {
    if (!shift) return

    setIsLoading(true)

    const result = await removeActingCaptain(shift.id, userId)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success(`${firefighterName} n'est plus désigné comme capitaine`)

    setIsLoading(false)
    refreshAndClose()
  }

  const handleRemoveReplacement = async (
    shiftId: number,
    userId: number,
    replacementOrder: number,
    firefighterName: string,
  ) => {
    // Added
    setIsLoading(true)

    const result = await removeReplacement(shiftId, userId, replacementOrder)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success(`${firefighterName} a été retiré du remplacement`)

    setIsLoading(false)
    refreshAndClose()
  }

  const availableFirefighters = [...allFirefighters].sort((a, b) => {
    // Role priority: captain (1) > lieutenant (2) > firefighter (3)
    const rolePriority = { captain: 1, lieutenant: 2, firefighter: 3 }
    const priorityA = rolePriority[a.role] || 3
    const priorityB = rolePriority[b.role] || 3

    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }

    // For same role, sort by position_code (Capitaine, Lieutenant, pp1, pp2, pp3, pp4, pp5, pp6)
    const posA = a.position_code || "pp999" // Changed fallback to pp999 for stable sort
    const posB = b.position_code || "pp999"

    const numA = posA.match(/\d+/) ? Number.parseInt(posA.match(/\d+/)[0]) : 999
    const numB = posB.match(/\d+/) ? Number.parseInt(posB.match(/\d+/)[0]) : 999

    return numA - numB
  })

  const originalOrderMap = new Map<number, number>()
  currentAssignments.forEach((assignment, index) => {
    originalOrderMap.set(assignment.user_id, index)
    if (assignment.replaced_user_id && !originalOrderMap.has(assignment.replaced_user_id)) {
      // Replaced firefighters get the same position as their replacement
      originalOrderMap.set(assignment.replaced_user_id, index)
    }
  })

  const displayedAssignments = (currentAssignments || [])
    .filter((assignment) => !removedExtraFirefighters.includes(assignment.user_id))
    .filter((assignment) => {
      // Filter out replacements from applications
      if (assignment.is_replacement) return false
      // Filter out direct assignments that are replacing someone
      if (assignment.is_direct_assignment && assignment.replaced_user_id) return false
      return true
    })
    .map((assignment) => {
      return {
        ...assignment,
        name: `${assignment.first_name} ${assignment.last_name}`,
        // replacement_order is already in assignment from SQL query (12th field)
      }
    })
    .concat(
      assignedReplacements.map((r: any) => {
        const approvedApp = r.applications.find((app: any) => app.status === "approved")
        return {
          id: `replacement-${r.id}`,
          user_id: approvedApp.applicant_id,
          first_name: approvedApp.first_name,
          last_name: approvedApp.last_name,
          role: approvedApp.role,
          email: approvedApp.email,
          is_extra: false,
          is_replacement: true,
          replacement_id: r.id,
          replaced_user_id: r.user_id,
          replaced_first_name: r.first_name,
          replaced_last_name: r.last_name,
          is_partial: r.is_partial,
          start_time: r.start_time,
          end_time: r.end_time,
          is_acting_lieutenant: r.is_acting_lieutenant || false,
          is_acting_captain: r.is_acting_captain || false,
          replacement_order: 1, // Replacements from applications are always order 1
        }
      }),
    )

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

  const groupedReplacements = new Map<number, Array<any>>()

  currentAssignments.forEach((assignment) => {
    if (assignment.is_direct_assignment && assignment.replaced_user_id) {
      if (!groupedReplacements.has(assignment.replaced_user_id)) {
        groupedReplacements.set(assignment.replaced_user_id, [])
      }
      const replacedFF = allFirefighters?.find((ff) => ff.id === assignment.replaced_user_id)
      groupedReplacements.get(assignment.replaced_user_id)!.push({
        user_id: assignment.user_id,
        first_name: assignment.first_name,
        last_name: assignment.last_name,
        role: assignment.role,
        email: assignment.email,
        start_time: assignment.start_time,
        end_time: assignment.end_time,
        is_partial: assignment.is_partial,
        is_direct_assignment: true,
        is_replacement: false,
        replacement_order: assignment.replacement_order || 2,
        // Store the real names from allFirefighters
        replaced_first_name: replacedFF?.first_name || "Pompier",
        replaced_last_name: replacedFF?.last_name || "Inconnu",
        replaced_position_code: replacedFF?.position_code || "", // Store position_code for sorting
      })
    }
  })

  assignedReplacements.forEach((r: any) => {
    const approvedApp = r.applications.find((app: any) => app.status === "approved")
    if (!groupedReplacements.has(r.user_id)) {
      groupedReplacements.set(r.user_id, [])
    }
    const replacedFF = allFirefighters?.find((ff) => ff.id === r.user_id)
    groupedReplacements.get(r.user_id)!.push({
      user_id: approvedApp.applicant_id,
      first_name: approvedApp.first_name,
      last_name: approvedApp.last_name,
      role: approvedApp.role,
      email: approvedApp.email,
      start_time: r.start_time,
      end_time: r.end_time,
      is_partial: r.is_partial,
      is_replacement: true,
      is_direct_assignment: false,
      replacement_id: r.id,
      replacement_order: 1,
      is_acting_lieutenant: r.is_acting_lieutenant || false,
      is_acting_captain: r.is_acting_captain || false,
      // Store the real names from allFirefighters
      replaced_first_name: replacedFF?.first_name || r.first_name,
      replaced_last_name: replacedFF?.last_name || r.last_name,
      replaced_position_code: replacedFF?.position_code || "", // Store position_code for sorting
    })
  })

  const handleDeadlineChange = (selectedValue: number | null | Date | null) => {
    if (selectedValue === -1) {
      setDeadlineSeconds(-1)
    } else {
      setDeadlineSeconds(selectedValue)
    }
  }

  return (
    <>
      {shift && (
        <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Pompiers assignés au quart</SheetTitle>
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2">
                  <Badge className={getTeamColor(shift.team_name, shift.team_color)}>{shift.team_name}</Badge>
                  <Badge className={getShiftTypeColor(shift.shift_type)}>{getShiftTypeLabel(shift.shift_type)}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Jour {shift.cycle_day} • {shift.date.toLocaleDateString("fr-CA")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  {(teamFirefighters || []).length} pompiers
                </div>
              </div>
            </SheetHeader>

            <div className="mt-4 space-y-2">
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
              {currentAssignments && currentAssignments.length > 0 ? (
                Array.from(
                  new Map(
                    currentAssignments
                      .filter(
                        (assignment) =>
                          !assignment.is_replacement &&
                          !(assignment.is_direct_assignment && assignment.replaced_user_id),
                      )
                      .map((assignment) => [
                        assignment.user_id,
                        {
                          id: assignment.user_id,
                          first_name: assignment.first_name,
                          last_name: assignment.last_name,
                          role: assignment.role,
                          email: assignment.email,
                        },
                      ]),
                  ).values(),
                )
                  .concat(
                    Array.from(groupedReplacements.entries()).map(([replacedUserId, replacements]) => {
                      // Find the real firefighter info from allFirefighters (not teamFirefighters)
                      const replacedFF = allFirefighters?.find((ff) => ff.id === replacedUserId)
                      if (replacedFF) {
                        return replacedFF
                      }
                      // Fallback to names stored in replacement data
                      const firstReplacement = replacements[0]
                      return {
                        id: replacedUserId,
                        first_name: firstReplacement.replaced_first_name || "Pompier",
                        last_name: firstReplacement.replaced_last_name || "Inconnu",
                        role: "firefighter",
                        email: "",
                        position_code: firstReplacement.replaced_position_code || "", // Use stored position_code
                      }
                    }),
                  )
                  .filter((firefighter, index, self) => self.findIndex((f) => f.id === firefighter.id) === index)
                  .sort((a, b) => {
                    const indexA = originalOrderMap.get(a.id) ?? 999
                    const indexB = originalOrderMap.get(b.id) ?? 999
                    return indexA - indexB
                  })
                  .map((firefighter) => {
                    const replacements = groupedReplacements.get(firefighter.id) || []
                    const hasReplacements = replacements.length > 0

                    // Case 1: Firefighter has been replaced - show replacement card
                    if (hasReplacements) {
                      const replacement1 = replacements.find((r) => r.replacement_order === 1)
                      const replacement2 = replacements.find((r) => r.replacement_order === 2)

                      return (
                        <Card key={`replaced-${firefighter.id}`} className="border-green-300 bg-green-50/30">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium">
                                    {firefighter.first_name} {firefighter.last_name}
                                  </p>
                                </div>
                                {firefighter.email && (
                                  <p className="text-xs text-muted-foreground">{firefighter.email}</p>
                                )}

                                <div className="mt-2 space-y-2">
                                  {replacement1 && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">
                                        {replacement2 ? "Remplaçant 1" : "Remplaçant"}: {replacement1.first_name}{" "}
                                        {replacement1.last_name}
                                        {(() => {
                                          if (!replacement2) {
                                            if (replacement1.start_time && replacement1.end_time) {
                                              return (
                                                <span>
                                                  {" "}
                                                  ({replacement1.start_time.slice(0, 5)}-
                                                  {replacement1.end_time.slice(0, 5)})
                                                </span>
                                              )
                                            }
                                            return <span> (Quart complet)</span>
                                          }

                                          // If Replacement 2 exists, use replacement 1's hours as the base (not shift hours)
                                          // This handles partial replacements correctly
                                          const r1Start =
                                            replacement1.start_time?.slice(0, 5) ||
                                            shift?.start_time?.slice(0, 5) ||
                                            "07:00"
                                          const r1End =
                                            replacement1.end_time?.slice(0, 5) ||
                                            shift?.end_time?.slice(0, 5) ||
                                            "17:00"
                                          const r2Start = replacement2.start_time?.slice(0, 5) || ""
                                          const r2End = replacement2.end_time?.slice(0, 5) || ""

                                          // Replacement 2 covers beginning of replacement period
                                          if (r2Start === r1Start && r2End !== r1End) {
                                            return (
                                              <span>
                                                {" "}
                                                ({r2End}-{r1End})
                                              </span>
                                            )
                                          }

                                          // Replacement 2 covers end of replacement period
                                          if (r2Start !== r1Start && r2End === r1End) {
                                            return (
                                              <span>
                                                {" "}
                                                ({r1Start}-{r2Start})
                                              </span>
                                            )
                                          }

                                          // Replacement 2 is in the middle - show two periods
                                          if (r2Start !== r1Start && r2End !== r1End) {
                                            return (
                                              <span>
                                                {" "}
                                                ({r1Start}-{r2Start}) ET ({r2End}-{r1End})
                                              </span>
                                            )
                                          }

                                          // Replacement 2 covers full replacement period (shouldn't happen)
                                          return <span> (Aucune heure restante)</span>
                                        })()}
                                      </Badge>
                                      {isAdmin && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            if (replacement1.is_direct_assignment) {
                                              handleRemoveDirectAssignment(
                                                replacement1.user_id,
                                                `${replacement1.first_name} ${replacement1.last_name}`,
                                              )
                                            } else if (replacement1.is_replacement) {
                                              handleRemoveReplacementAssignment(
                                                replacement1.replacement_id,
                                                `${replacement1.first_name} ${replacement1.last_name}`,
                                              )
                                            } else {
                                              handleRemoveReplacement(
                                                shift.id,
                                                replacement1.user_id,
                                                1,
                                                `${replacement1.first_name} ${replacement1.last_name}`,
                                              )
                                            }
                                          }}
                                          disabled={isLoading || loadingReplacements}
                                          className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  )}

                                  {replacement2 && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">
                                        {replacement1 ? "Remplaçant 2" : "Remplaçant"}: {replacement2.first_name}{" "}
                                        {replacement2.last_name}
                                        {replacement2.start_time && replacement2.end_time && (
                                          <span>
                                            {" "}
                                            ({replacement2.start_time.slice(0, 5)}-{replacement2.end_time.slice(0, 5)})
                                          </span>
                                        )}
                                      </Badge>

                                      {isAdmin && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleRemoveReplacement(
                                              shift.id,
                                              replacement2.user_id,
                                              2,
                                              `${replacement2.first_name} ${replacement2.last_name}`,
                                            )
                                          }
                                          disabled={isLoading || loadingReplacements}
                                          className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  )}

                                  {replacement1 && !replacement2 && isAdmin && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedReplacementForSecond({
                                          replacedFirefighter: {
                                            id: firefighter.id,
                                            first_name: firefighter.first_name,
                                            last_name: firefighter.last_name,
                                          },
                                          firstReplacementUserId: replacement1.user_id,
                                        })
                                        setShowSecondReplacementDialog(true)
                                      }}
                                      disabled={isLoading || loadingReplacements}
                                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                    >
                                      + Remplaçant 2
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getRoleBadgeColor(firefighter.role)}>
                                  {getRoleLabel(firefighter.role)}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    }

                    // Case 2: Firefighter is in displayedAssignments (assigned to shift)
                    const assignment = displayedAssignments.find((a) => a.user_id === firefighter.id)
                    if (assignment) {
                      const firefighterId = assignment.user_id || assignment.id

                      const replacement = !loadingReplacements ? getReplacementForFirefighter(firefighterId) : null
                      const hasReplacement = !!replacement

                      const isReplacementFirefighter = assignment.is_replacement === true

                      const firefighterLeave = getFirefighterLeaveForDate(assignment.user_id, shift.date, leaves)
                      const hasPartialLeave =
                        firefighterLeave && firefighterLeave.start_time && firefighterLeave.end_time

                      const hasPartialReplacement =
                        replacement?.is_partial && replacement?.start_time && replacement?.end_time

                      const isExtraRequest =
                        assignment.first_name === "Pompier" && assignment.last_name === "supplémentaire"

                      const exchange = getExchangeForFirefighter(
                        assignment.user_id,
                        assignment.first_name,
                        assignment.last_name,
                        assignment.role,
                      )
                      const hasExchange = !!exchange

                      const displayName = isExtraRequest
                        ? "Pompier supplémentaire"
                        : assignment.name || `${assignment.first_name} ${assignment.last_name}`

                      let exchangePartner = null
                      let exchangePartialTimes = null

                      if (hasExchange) {
                        if (exchange.type === "requester") {
                          exchangePartner = `${exchange.requester_first_name} ${exchange.requester_last_name}`
                          if (exchange.is_partial && exchange.requester_start_time && exchange.requester_end_time) {
                            exchangePartialTimes = `${exchange.requester_start_time.slice(0, 5)}-${exchange.requester_end_time.slice(0, 5)}`
                          }
                        } else {
                          exchangePartner = `${exchange.requester_first_name} ${exchange.requester_last_name}`
                          if (exchange.is_partial && exchange.target_start_time && exchange.target_end_time) {
                            exchangePartialTimes = `${exchange.target_start_time.slice(0, 5)}-${exchange.target_end_time.slice(0, 5)}`
                          }
                        }
                      }

                      const isReplacementAssigned = replacement?.status === "assigned"
                      const assignedApplication = replacement?.applications?.find(
                        (app: any) => app.status === "approved",
                      )
                      const assignedFirefighterName = assignedApplication
                        ? `${assignedApplication.first_name} ${assignedApplication.last_name}`
                        : null

                      const isDirectAssignment = assignment.is_direct_assignment === true

                      return (
                        <Card
                          key={assignment.id}
                          className={
                            assignment.is_extra
                              ? "border-amber-300 bg-amber-50/30"
                              : hasExchange
                                ? "border-purple-300 bg-purple-50/30"
                                : isReplacementFirefighter
                                  ? "border-green-300 bg-green-50/30"
                                  : isDirectAssignment
                                    ? "border-blue-300 bg-blue-50/30"
                                    : ""
                          }
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
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
                                  {isReplacementFirefighter && (
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                                      <span className="text-green-700 mr-1">✓</span>
                                      Remplaçant
                                    </Badge>
                                  )}
                                  {isDirectAssignment && (
                                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                                      Assignation directe
                                    </Badge>
                                  )}
                                  {isDirectAssignment &&
                                    assignment.is_partial &&
                                    assignment.start_time &&
                                    assignment.end_time && (
                                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                                        Partiel: {assignment.start_time.slice(0, 5)} - {assignment.end_time.slice(0, 5)}
                                      </Badge>
                                    )}
                                </div>
                                {!isExtraRequest && assignment.email && (
                                  <p className="text-xs text-muted-foreground">{assignment.email}</p>
                                )}
                                {isReplacementFirefighter && assignment.replaced_first_name && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Remplace {assignment.replaced_first_name} {assignment.replaced_last_name}
                                  </p>
                                )}
                                {isDirectAssignment && assignment.replaced_name && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Remplace {assignment.replaced_name}
                                  </p>
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
                                        className="text-foreground hover:bg-gray-50"
                                      >
                                        <Users className="h-4 w-4 mr-1" />
                                        Voir les candidats ({replacement.applications.length})
                                      </Button>
                                    )}
                                    {isAdmin && (
                                      <DeleteReplacementButton
                                        replacementId={replacement.id}
                                        onSuccess={refreshAndClose}
                                      />
                                    )}
                                  </div>
                                )}
                                {isDirectAssignment && isAdmin && (
                                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleRemoveDirectAssignment(assignment.user_id, displayName)}
                                      disabled={isLoading || loadingReplacements}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Retirer
                                    </Button>
                                    {assignment.is_acting_captain ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleRemoveCaptain(assignment.user_id || assignment.id, displayName)
                                        }
                                        disabled={isLoading || loadingReplacements}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        Retirer Cpt
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleSetCaptain(assignment.user_id || assignment.id, displayName)
                                        }
                                        disabled={isLoading || loadingReplacements}
                                        className="text-cyan-600 hover:bg-cyan-50"
                                      >
                                        Désigner Cpt
                                      </Button>
                                    )}
                                    {assignment.is_acting_lieutenant ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleRemoveLieutenant(assignment.user_id || assignment.id, displayName)
                                        }
                                        disabled={isLoading || loadingReplacements}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        Retirer Lt
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleSetLieutenant(assignment.user_id || assignment.id, displayName)
                                        }
                                        disabled={isLoading || loadingReplacements}
                                        className="text-cyan-600 hover:bg-cyan-50"
                                      >
                                        Désigner Lt
                                      </Button>
                                    )}
                                  </div>
                                )}
                                {!isReplacementFirefighter &&
                                  !isDirectAssignment &&
                                  !assignment.is_extra &&
                                  isAdmin && (
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                      {!hasReplacement && (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              setSelectedFirefighter({
                                                id: assignment.user_id,
                                                first_name: assignment.first_name,
                                                last_name: assignment.last_name,
                                              })
                                            }
                                            disabled={isLoading || loadingReplacements}
                                            className="text-orange-600 hover:bg-orange-50"
                                          >
                                            Remplacement
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setSelectedFirefighter(firefighter)
                                              setShowDirectAssignmentDialog(true)
                                            }}
                                            disabled={isLoading || loadingReplacements}
                                            className="text-orange-600 hover:bg-orange-50"
                                          >
                                            Assigner directement
                                          </Button>
                                        </>
                                      )}
                                      {assignment.is_acting_lieutenant ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleRemoveLieutenant(assignment.user_id || assignment.id, displayName)
                                          }
                                          disabled={isLoading || loadingReplacements}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                          Retirer Lt
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleSetLieutenant(assignment.user_id || assignment.id, displayName)
                                          }
                                          disabled={isLoading || loadingReplacements}
                                          className="text-cyan-600 hover:bg-cyan-50"
                                        >
                                          Désigner Lt
                                        </Button>
                                      )}
                                      {assignment.is_acting_captain ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleRemoveCaptain(assignment.user_id || assignment.id, displayName)
                                          }
                                          disabled={isLoading || loadingReplacements}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                          Retirer Cpt
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleSetCaptain(assignment.user_id || assignment.id, displayName)
                                          }
                                          disabled={isLoading || loadingReplacements}
                                          className="text-cyan-600 hover:bg-cyan-50"
                                        >
                                          Désigner Cpt
                                        </Button>
                                      )}
                                    </div>
                                  )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getRoleBadgeColor(assignment.role)}>
                                  {getRoleLabel(assignment.role)}
                                </Badge>
                                {assignment.is_extra && !isExtraRequest && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRemoveExtraFirefighter(assignment.user_id, displayName)}
                                    disabled={isLoading || loadingReplacements}
                                    className="text-red-600 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    }

                    // Case 3: Firefighter is not assigned and has no replacements - show basic card
                    return (
                      <Card key={`unassigned-${firefighter.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">
                                  {firefighter.first_name} {firefighter.last_name}
                                </p>
                              </div>
                              {firefighter.email && (
                                <p className="text-xs text-muted-foreground">{firefighter.email}</p>
                              )}
                              {isAdmin && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedFirefighter(firefighter)}
                                    disabled={isLoading || loadingReplacements}
                                    className="text-orange-600 hover:bg-orange-50"
                                  >
                                    Remplacement
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedFirefighter(firefighter)
                                      setShowDirectAssignmentDialog(true)
                                    }}
                                    disabled={isLoading || loadingReplacements}
                                    className="text-orange-600 hover:bg-orange-50"
                                  >
                                    Assigner directement
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getRoleBadgeColor(firefighter.role)}>
                                {getRoleLabel(firefighter.role)}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
              ) : (
                <p className="text-sm text-muted-foreground p-4">Aucun pompier disponible pour ce quart.</p>
              )}
            </div>

            {/* Removed the extra section that displays replaced firefighters again */}

            {/* Use displayedAssignments to check if it's empty */}
            {displayedAssignments.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Aucun pompier assigné à ce quart</p>
                </CardContent>
              </Card>
            )}
          </SheetContent>
        </Sheet>
      )}

      <AlertDialog
        open={!!selectedFirefighter && !showDeadlineWarning && !showDirectAssignmentDialog}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedFirefighter(null)
            setIsPartial(false)
            setDeadlineSeconds(null)
            const times = getDefaultReplacementTimes(shift?.shift_type)
            setStartTime(times.startTime)
            setEndTime(times.endTime)
          }
        }}
      >
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
              pour le quart du {shift?.date.toLocaleDateString("fr-CA")} ({shift?.shift_type}) ?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            {shift && (
              <DeadlineSelect
                value={deadlineSeconds}
                onValueChange={handleDeadlineChange}
                shiftDate={shift.date}
                shiftEndTime={isPartial ? endTime : shift.end_time}
                partialEndTime={isPartial ? endTime : undefined}
                isPartial={isPartial}
                shift={shift}
              />
            )}

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

      <AlertDialog open={showDeadlineWarning} onOpenChange={setShowDeadlineWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Délai automatique expiré</AlertDialogTitle>
            <AlertDialogDescription>
              Le délai automatique pour ce remplacement est déjà expiré.
              <br />
              <br />
              Veuillez recommencer en spécifiant un délai personnalisé qui n'est pas expiré.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Fermer
            </Button>
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
            {shift && (
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
            )}

            {(isCreatingRequest || isExtraPartial) && (
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
                setExtraDeadlineSeconds(null)
                setShowExtraDeadlineWarning(false)
                const times = getDefaultReplacementTimes(shift?.shift_type)
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

      <AlertDialog open={showExtraDeadlineWarning} onOpenChange={setShowExtraDeadlineWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Délai par défaut expiré</AlertDialogTitle>
            <AlertDialogDescription>
              Le délai par défaut pour ce remplacement est déjà passé. Les pompiers ne pourront pas postuler à moins que
              vous définissiez un nouveau délai.
              <br />
              <br />
              Voulez-vous quand même créer cette demande de pompier supplémentaire ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowExtraDeadlineWarning(false)
                setShowExtraDialog(false)
                setSelectedExtraFirefighter(null)
                setIsCreatingRequest(false)
              }}
            >
              Annuler
            </Button>
            <AlertDialogAction onClick={executeCreateExtraRequest} className="bg-orange-600 hover:bg-orange-700">
              Créer quand même
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {shift && (
        <DirectAssignmentDialog
          open={showDirectAssignmentDialog}
          onOpenChange={(open) => {
            setShowDirectAssignmentDialog(open)
            if (!open) {
              setSelectedFirefighter(null)
            }
          }}
          shift={shift}
          teamFirefighters={teamFirefighters}
          allFirefighters={allFirefighters}
          onSuccess={refreshAndClose}
          preSelectedFirefighter={selectedFirefighter}
        />
      )}

      {shift && selectedReplacementForSecond && (
        <AddSecondReplacementDialog
          open={showSecondReplacementDialog}
          onOpenChange={setShowSecondReplacementDialog}
          shift={shift}
          replacedFirefighter={selectedReplacementForSecond.replacedFirefighter}
          firstReplacementUserId={selectedReplacementForSecond.firstReplacementUserId}
          allFirefighters={allFirefighters}
          onSuccess={() => {
            setShowSecondReplacementDialog(false)
            setSelectedReplacementForSecond(null)
            refreshAndClose()
          }}
        />
      )}
    </>
  )
}
