"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import { UserPlus, Trash2, Users, Zap } from "lucide-react" // Added Zap icon
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input" // Added Input import
import { getDefaultReplacementTimes } from "@/lib/shift-utils"
import { ApplyForReplacementButton } from "@/components/apply-for-replacement-button"
import { DeleteReplacementButton } from "@/components/delete-replacement-button"
import { DeadlineSelect } from "@/components/deadline-select"
import { formatDateForDB } from "@/lib/date-utils"
import { calculateAutoDeadline } from "@/lib/date-utils"
import { DirectAssignmentDialog } from "@/components/direct-assignment-dialog"
import { AddSecondReplacementDialog } from "@/components/add-second-replacement-dialog" // Added
import { EmailSendResultsModal } from "./email-send-results-modal"
import { LeaveBankSelector } from "./leave-bank-selector"
import { AddManualApplicationDialog } from "./add-manual-application-dialog"
import { getActingDesignationsForRange } from "@/app/actions/calendar" // Added import

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
    team_members?: Array<any> // Added for direct assignments fallback
    assigned_firefighters?: string // Added for sorting by rank
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
    replacement_id?: number // Added to store replacement ID for replacements
    leave_bank_1?: string // Added leave bank fields
    leave_hours_1?: number
    leave_bank_2?: string
    leave_hours_2?: number
  }>
  leaves: Array<any>
  dateStr: string
  isAdmin?: boolean
  currentUserId?: number
  onReplacementCreated?: () => void
  onShiftUpdated?: (shift: any) => void
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
  onShiftUpdated,
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
  const [isPartial, setIsPartial] = useState(false) // Declared isPartial
  const startTime = "07:00" // Placeholder, this should be managed by state
  const endTime = "17:00" // Placeholder, this should be managed by state
  const [deadlineSeconds, setDeadlineSeconds] = useState<number | null>(null)
  const [leaveBank1, setLeaveBank1] = useState<string>("")
  const [leaveHours1, setLeaveHours1] = useState<string>("")
  const [leaveBank2, setLeaveBank2] = useState<string>("")
  const [leaveHours2, setLeaveHours2] = useState<string>("")

  const defaultTimes = shift ? getDefaultReplacementTimes(shift.shift_type) : { startTime: "07:00", endTime: "17:00" }
  const [partialStartTime, setPartialStartTime] = useState(defaultTimes.startTime)
  const [partialEndTime, setPartialEndTime] = useState(defaultTimes.endTime)
  const [showExtraDialog, setShowExtraDialog] = useState(false)
  const [isCreatingRequest, setIsCreatingRequest] = useState(false)
  const [selectedExtraFirefighter, setSelectedExtraFirefighter] = useState<number | string | null>(null)
  const [allFirefighters, setAllFirefighters] = useState<any[]>([])
  const [isExtraPartial, setIsExtraPartial] = useState(false)
  const [extraStartTime, setExtraStartTime] = useState(defaultTimes.startTime)
  const [extraEndTime, setExtraEndTime] = useState(defaultTimes.endTime)
  const [extraFirefighters, setExtraFirefighters] = useState<number[]>([])
  const [removedExtraFirefighters, setRemovedExtraFirefighters] = useState<number[]>([])
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

  const [emailResults, setEmailResults] = useState<any>(null)
  const [showEmailResults, setShowEmailResults] = useState(false)

  const [extraRequestMode, setExtraRequestMode] = useState<"request" | "assign" | null>("request")

  // State for Applications Dialog
  const [selectedReplacementId, setSelectedReplacementId] = useState<number | null>(null)
  const [showApplicationsDialog, setShowApplicationsDialog] = useState(false)

  // State for Direct Assignment Dialog
  const [showDirectAssignment, setShowDirectAssignment] = useState(false)
  const [selectedReplacementForAssignment, setSelectedReplacementForAssignment] = useState<number | null>(null)

  // Added state for AddManualApplicationDialog
  const [showAddManualApplicationDialog, setShowAddManualApplicationDialog] = useState(false)

  const [actingDesignations, setActingDesignations] = useState<Array<any>>([])

  const [refreshKey, setRefreshKey] = useState(0)

  const [showReplacementDialog, setShowReplacementDialog] = useState(false) // Added
  const [replacementOrder, setReplacementOrder] = useState<number>(1) // Added

  const translateShiftType = (type: string): string => {
    const translations: Record<string, string> = {
      day: "Jour",
      night: "Nuit",
      "24h": "24h",
    }
    return translations[type.toLowerCase()] || type
  }

  const handleExtraDeadlineChange = (value: number | null | Date | null) => {
    if (value === -1) {
      setExtraDeadlineSeconds(-1) // Explicitly set to -1 for "no deadline"
    } else if (typeof value === "number") {
      setExtraDeadlineSeconds(value)
    } else {
      setExtraDeadlineSeconds(null) // Handle null or Date objects
    }
  }

  useEffect(() => {
    if (open && shift) {
      console.log("[v0] ShiftAssignmentDrawer - currentAssignments:", currentAssignments.length)
      const withReplacementOrder = currentAssignments.filter((a) => a.replacement_order)
      if (withReplacementOrder.length > 0) {
        console.log(
          "[v0] Assignments with replacement_order:",
          withReplacementOrder.map((a) => ({
            name: `${a.first_name} ${a.last_name}`,
            replacement_order: a.replacement_order,
            start_time: a.start_time,
            end_time: a.end_time,
            replaced_user_id: a.replaced_user_id,
          })),
        )
      }
    }
  }, [open, shift, currentAssignments])

  useEffect(() => {
    if (open && shift && dateStr) {
      const loadActingDesignations = async () => {
        try {
          const data = await getActingDesignationsForRange(dateStr, dateStr)
          setActingDesignations(data)
        } catch (error) {
          console.error("[v0] Error loading acting designations:", error)
          setActingDesignations([])
        }
      }

      loadActingDesignations()
    }
  }, [open, shift, dateStr])

  useEffect(() => {
    if (open && shift && dateStr) {
      const loadReplacements = async () => {
        try {
          const shiftDate = dateStr
          const data = await getReplacementsForShift(shiftDate, shift.shift_type, shift.team_id)

          const assigned = data.filter((r: any) => {
            const hasApprovedApp = r.applications.some((app: any) => app.status === "approved")
            return hasApprovedApp
          })

          setAssignedReplacements(assigned)
        } catch (error) {
          console.error("[v0] Error loading replacements:", error)
          setAssignedReplacements([])
        }
      }

      loadReplacements()
    }
  }, [open, shift, dateStr])

  const refreshAndClose = useCallback(() => {
    // console.log("[v0] Drawer - refreshAndClose called")
    if (onReplacementCreated) {
      // console.log("[v0] Drawer - Calling onReplacementCreated callback")
      onReplacementCreated()
    } else {
      // console.log("[v0] Drawer - No onReplacementCreated callback available")
    }
    // console.log("[v0] Drawer - Closing drawer")
    onOpenChange(false)
  }, [onReplacementCreated, onOpenChange])

  const refreshShiftAndClose = useCallback(async () => {
    // console.log("[v0] Drawer - refreshShiftAndClose called")

    if (onShiftUpdated) {
      // console.log("[v0] Drawer - Calling onShiftUpdated callback")
      await onShiftUpdated(shift)
    } else {
      // console.log("[v0] Drawer - No onShiftUpdated callback available")
    }

    // console.log("[v0] Drawer - Closing drawer")
    onOpenChange(false)
  }, [onShiftUpdated, shift, onOpenChange])

  const loadData = useCallback(async () => {
    if (!open || !shift) return

    // </CHANGE> Removed debug logs
    setLoadingReplacements(true)
    const shiftDate = formatDateForDB(shift.date)

    try {
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

      const firefighters = await getAllFirefighters()
      setAllFirefighters(firefighters)

      if (onShiftUpdated) {
        onShiftUpdated(shift)
      }

      setRefreshKey((prev) => prev + 1)
    } catch (error) {
      console.error("[v0] Drawer - Error fetching data:", error)
      toast.error("Erreur lors du chargement des données.")
    } finally {
      setLoadingReplacements(false)
    }
  }, [open, shift, onShiftUpdated, allFirefighters.length])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!open) return

    const handleShiftUpdated = () => {
      // </CHANGE> Removed debug log
      loadData()
    }

    window.addEventListener("shift-updated", handleShiftUpdated)

    return () => {
      window.removeEventListener("shift-updated", handleShiftUpdated)
    }
  }, [open, loadData])

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
          body: JSON.JSON.stringify({
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
      // console.log("[v0] Drawer - saving scroll at start of handleCreateReplacement:", scrollPos)
      sessionStorage.setItem("calendar-scroll-position", scrollPos.toString())
      sessionStorage.setItem("skip-scroll-to-today", "true")
    }

    if (!selectedFirefighter || isLoading) return

    if (isPartial && partialStartTime >= partialEndTime) {
      toast.error("L'heure de début doit être avant l'heure de fin")
      return
    }

    if (deadlineSeconds === null || deadlineSeconds === undefined || deadlineSeconds === 0) {
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
      isPartial ? partialStartTime : undefined,
      isPartial ? partialEndTime : undefined,
      deadlineSeconds ?? undefined, // Use ?? undefined to ensure undefined if null/0
      shift.start_time,
      shift.end_time,
      leaveBank1 || undefined,
      leaveHours1 ? Number.parseFloat(leaveHours1) : undefined,
      leaveBank2 || undefined,
      leaveHours2 ? Number.parseFloat(leaveHours2) : undefined,
    )

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success("Demande de remplacement créée avec succès")

    if (result.emailResults) {
      setEmailResults(result.emailResults)
      setShowEmailResults(true)
    }

    const data = await getReplacementsForShift(shiftDate, shift.shift_type, shift.team_id)
    setReplacements(data)

    setIsLoading(false)
    setSelectedFirefighter(null)
    setLeaveBank1("")
    setLeaveHours1("")
    setLeaveBank2("")
    setLeaveHours2("")
    setIsPartial(false) // Reset isPartial to false after successful creation
    setDeadlineSeconds(null)
    setShowDeadlineWarning(false)
    const times = getDefaultReplacementTimes(shift.shift_type)
    setPartialStartTime(times.startTime)
    setPartialEndTime(times.endTime)

    if (onReplacementCreated) {
      onReplacementCreated()
    }

    refreshAndClose()
  }

  const handleCancel = () => {
    setSelectedFirefighter(null)
    // Reset partial states to false and clear times
    setIsPartial(false)
    setPartialStartTime(getDefaultReplacementTimes(shift?.shift_type).startTime)
    setPartialEndTime(getDefaultReplacementTimes(shift?.shift_type).endTime)

    setLeaveBank1("")
    setLeaveHours1("")
    setLeaveBank2("")
    setLeaveHours2("")

    setDeadlineSeconds(null)
    setShowDeadlineWarning(false)
    // const times = getDefaultReplacementTimes(shift.shift_type) // Already defined above
    // setStartTime(times.startTime)
    // setEndTime(times.endTime)
  }

  const getReplacementForFirefighter = (firefighterId: number | undefined) => {
    if (!firefighterId) return null
    const found = replacements.find((r) => r.user_id === firefighterId)
    return found || null
  }

  const getAllReplacementsForExtraFirefighters = () => {
    // Get ALL replacements where user_id is null (all extra firefighters)
    return replacements.filter((r) => r.user_id === null)
  }

  const getReplacementForExtraFirefighter = () => {
    // For backward compatibility - returns first extra firefighter
    const found = replacements.find((r) => r.user_id === null)
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
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
        times.push(timeString)
      }
    }
    return times
  }

  const handleAddExtraFirefighter = async () => {
    // console.log("[v0] handleAddExtraFirefighter called!")
    // console.log("[v0] extraRequestMode:", extraRequestMode)
    // console.log("[v0] selectedExtraFirefighter:", selectedExtraFirefighter)
    // console.log("[v0] extraDeadlineSeconds:", extraDeadlineSeconds)
    // console.log("[v0] isExtraPartial:", isExtraPartial)

    await handleCreateExtraRequest()
    return
  }

  const handleCreateExtraRequest = async () => {
    if (isLoading) return

    if (isExtraPartial && extraStartTime >= extraEndTime) {
      toast.error("L'heure de début doit être avant l'heure de fin")
      return
    }

    if (extraDeadlineSeconds === null || extraDeadlineSeconds === undefined || extraDeadlineSeconds === 0) {
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

    // console.log("[v0] Drawer - executeCreateExtraRequest with params:", {
    //   shiftDate,
    //   shift_type: shift.shift_type,
    //   team_id: shift.team_id,
    //   isExtraPartial,
    //   extraStartTime,
    //   extraEndTime,
    //   extraDeadlineSeconds,
    // })

    const result = await createExtraFirefighterReplacement(
      shiftDate,
      shift.shift_type,
      shift.team_id,
      isExtraPartial,
      isExtraPartial ? extraStartTime : undefined,
      isExtraPartial ? extraEndTime : undefined,
      extraDeadlineSeconds ?? undefined, // Use ?? undefined to ensure undefined if null/0
    )

    if (result.error) {
      // console.log("[v0] Drawer - executeCreateExtraRequest failed:", result.error)
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    // console.log("[v0] Drawer - executeCreateExtraRequest success, replacement ID:", result.id)
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

  const handleRemoveReplacementAssignment = async (replacementId: number, replacementName?: string) => {
    // Added replacementName parameter for toast message
    if (typeof window !== "undefined") {
      const scrollPos = window.scrollY
      // console.log("[v0] Drawer - saving scroll before removeReplacementAssignment:", scrollPos)
      sessionStorage.setItem("calendar-scroll-position", scrollPos.toString())
      sessionStorage.setItem("skip-scroll-to-today", "true")
    }

    setIsLoading(true)

    const result = await removeReplacementAssignment(replacementId)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success(`${replacementName || "Le remplacement"} a été retiré`)

    console.log("[v0] Drawer - About to call loadData() to refresh drawer after assignment removal")
    await loadData()
    console.log("[v0] Drawer - loadData() completed, drawer should now show updated data")

    setIsLoading(false)
  }

  const handleRemoveDirectAssignment = async (shiftId: number, userId: number, replacementOrder?: number) => {
    // Added shiftId and replacementOrder parameters for consistency with removeReplacement
    // console.log("[v0] Drawer - handleRemoveDirectAssignment called for userId:", userId)

    if (typeof window !== "undefined") {
      const scrollPos = window.scrollY
      // console.log("[v0] Drawer - saving scroll before removeDirectAssignment:", scrollPos)
      sessionStorage.setItem("calendar-scroll-position", scrollPos.toString())
      sessionStorage.setItem("skip-scroll-to-today", "true")
    }

    setIsLoading(true)

    const result = await removeDirectAssignment(shiftId, userId, replacementOrder)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success(`Assignation directe retirée`) // Generic success message

    setIsLoading(false)
    // console.log("[v0] Drawer - Calling refreshShiftAndClose after removeDirectAssignment")
    refreshShiftAndClose()
  }

  const handleSetLieutenant = async (userId: number, firefighterName: string) => {
    if (!shift) return

    if (typeof window !== "undefined") {
      const scrollPos = window.scrollY
      // console.log("[v0] Drawer - saving scroll before setActingLieutenant:", scrollPos)
      sessionStorage.setItem("calendar-scroll-position", scrollPos.toString())
      sessionStorage.setItem("skip-scroll-to-today", "true")
    }

    setIsLoading(true)

    // console.log("[v0] Calling setActingLieutenant for userId:", userId, "shiftId:", shift.id, "date:", dateStr)
    const result = await setActingLieutenant(shift.id, userId, dateStr)
    // console.log("[v0] setActingLieutenant result:", result)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success(`${firefighterName} a été désigné comme lieutenant`)

    setIsLoading(false)
    // console.log("[v0] Calling refreshShiftAndClose after setActingLieutenant")
    refreshShiftAndClose()
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
    refreshShiftAndClose()
  }

  const handleSetCaptain = async (userId: number, firefighterName: string) => {
    if (!shift) return

    setIsLoading(true)

    // console.log("[v0] Calling setActingCaptain for userId:", userId, "shiftId:", shift.id, "date:", dateStr)
    const result = await setActingCaptain(shift.id, userId, dateStr)
    // console.log("[v0] setActingCaptain result:", result)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success(`${firefighterName} a été désigné comme capitaine`)

    setIsLoading(false)
    // console.log("[v0] Calling refreshShiftAndClose after setActingCaptain")
    refreshShiftAndClose()
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
    refreshShiftAndClose()
  }

  const handleRemoveReplacement = async (
    shiftId: number,
    userId: number,
    replacementOrder: number, // Changed to number
    firefighterName: string,
  ) => {
    if (typeof window !== "undefined") {
      const scrollPos = window.scrollY
      // console.log("[v0] Drawer - saving scroll before removeReplacement:", scrollPos)
      sessionStorage.setItem("calendar-scroll-position", scrollPos.toString())
      sessionStorage.setItem("skip-scroll-to-today", "true")
    }

  setIsLoading(true)
  
  console.log("[v0] DRAWER BUTTON: handleRemoveReplacement CALLED with:", {
    shiftId,
    userId,
    replacementOrder,
    firefighterName,
  })
  
  const result = await removeReplacement(shiftId, userId, replacementOrder)
  
  console.log("[v0] DRAWER BUTTON: removeReplacement returned:", result)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success(`${firefighterName} a été retiré du remplacement`)

    setIsLoading(false)
    refreshAndClose()
  }

  // Handlers for removing replacements from the UI
  const handleRemoveReplacement1 = async (firefighterId: number) => {
    const replacementsForUser = groupedReplacements.get(firefighterId)
    if (!replacementsForUser) return

    const replacement1 = replacementsForUser.find((r) => r.replacement_order === 1)
    if (!replacement1) return

    // console.log("[v0] Drawer - removing replacement1:", {
    //   userId: replacement1.user_id,
    //   firstName: replacement1.first_name,
    //   lastName: replacement1.last_name,
    //   is_direct_assignment: replacement1.is_direct_assignment,
    //   is_replacement: replacement1.is_replacement,
    //   replacement_id: replacement1.replacement_id, // Log replacement_id
    //   replacement_order: replacement1.replacement_order,
    // })

    const isReplacementViaApplication = replacement1.replacement_id && !replacement1.is_direct_assignment

    if (replacement1.is_direct_assignment) {
      // console.log("[v0] Drawer - calling handleRemoveDirectAssignment")
      await handleRemoveDirectAssignment(
        replacement1.shift_id,
        replacement1.user_id,
        replacement1.replacement_order || 1,
      )
    } else if (isReplacementViaApplication) {
      // console.log(
      //   "[v0] Drawer - calling handleRemoveReplacementAssignment with replacement_id:",
      //   replacement1.replacement_id,
      // )
      await handleRemoveReplacementAssignment(
        replacement1.replacement_id,
        `${replacement1.first_name} ${replacement1.last_name}`,
      )
    } else {
      // console.log("[v0] Drawer - calling handleRemoveReplacement")
      await handleRemoveReplacement(
        replacement1.shift_id,
        replacement1.user_id,
        replacement1.replacement_order || 1,
        `${replacement1.first_name} ${replacement1.last_name}`,
      )
    }
  }

  const handleRemoveReplacement2 = async (firefighterId: number) => {
    const replacementsForUser = groupedReplacements.get(firefighterId)
    if (!replacementsForUser) return

    const replacement2 = replacementsForUser.find((r) => r.replacement_order === 2)
    if (!replacement2) return

    const isReplacementViaApplication = replacement2.replacement_id && !replacement2.is_direct_assignment

    if (replacement2.is_direct_assignment) {
      await handleRemoveDirectAssignment(shift.id, replacement2.user_id, replacement2.replacement_order || 2)
    } else if (isReplacementViaApplication) {
      await handleRemoveReplacementAssignment(
        replacement2.replacement_id,
        `${replacement2.first_name} ${replacement2.last_name}`,
      )
    } else {
      await handleRemoveReplacement(
        shift.id,
        replacement2.user_id,
        replacement2.replacement_order || 2,
        `${replacement2.first_name} ${replacement2.last_name}`,
      )
    }
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

  const permanentTeamMemberIds = useMemo(() => {
    const ids = new Set<number>()
    // Add all user_ids from currentAssignments - these are the permanent team members
    currentAssignments?.forEach((assignment) => {
      ids.add(assignment.user_id)
    })
    return ids
  }, [currentAssignments])

  const originalOrderMap = new Map<number, number>()

  // Format: "FirstName|LastName|role|user_id|rank|..."
  if (shift?.assigned_firefighters) {
    const firefighterEntries = shift.assigned_firefighters.split(";")
    firefighterEntries.forEach((entry: string) => {
      const parts = entry.split("|")
      if (parts.length >= 5) {
        const userId = Number.parseInt(parts[3], 10)
        const rank = Number.parseInt(parts[4], 10)
        if (!isNaN(userId) && !isNaN(rank)) {
          originalOrderMap.set(userId, rank)
        }
      }
    })
  }

  // Fallback: if assigned_firefighters doesn't have this user, use currentAssignments index
  currentAssignments.forEach((assignment, index) => {
    if (!originalOrderMap.has(assignment.user_id)) {
      // Use a high number to put them at the end
      originalOrderMap.set(assignment.user_id, 1000 + index)
    }
  })

  currentAssignments.forEach((assignment) => {
    if (assignment.replaced_user_id && !originalOrderMap.has(assignment.replaced_user_id)) {
      // Replaced firefighters get the same position as their replacement
      const replacerRank = originalOrderMap.get(assignment.user_id) ?? 1000
      originalOrderMap.set(assignment.replaced_user_id, replacerRank)
    }
  })

  const groupedReplacements = new Map<number, Array<any>>()

  const existingReplacementKeys = new Set<string>()
  currentAssignments.forEach((assignment) => {
    if (assignment.replacement_order && assignment.replaced_user_id) {
      existingReplacementKeys.add(`${assignment.user_id}_${assignment.replaced_user_id}`)
    }
  })

  currentAssignments.forEach((assignment) => {
    // Group by replacement_order (includes both direct assignments and approved replacements)
    if (assignment.replacement_order && assignment.replaced_user_id) {
      if (!groupedReplacements.has(assignment.replaced_user_id)) {
        groupedReplacements.set(assignment.replaced_user_id, [])
      }
      const replacedFF = allFirefighters?.find((ff) => ff.id === assignment.replaced_user_id)

      const replacedFromTeam = shift?.team_members?.find((tm: any) => tm.user_id === assignment.replaced_user_id)

      let replacementId = assignment.replacement_id

      if (!replacementId && !assignment.is_direct_assignment) {
        const matchingReplacement = assignedReplacements.find((r: any) => {
          const approvedApp = r.applications?.find((app: any) => app.status === "approved")
          return approvedApp?.applicant_id === assignment.user_id && r.user_id === assignment.replaced_user_id
        })
        if (matchingReplacement) {
          replacementId = matchingReplacement.id
        }
      }

      groupedReplacements.get(assignment.replaced_user_id)!.push({
        user_id: assignment.user_id,
        first_name: assignment.first_name,
        last_name: assignment.last_name,
        role: assignment.role,
        email: assignment.email,
        start_time: assignment.start_time,
        end_time: assignment.end_time,
        is_partial: assignment.is_partial,
        is_direct_assignment: assignment.is_direct_assignment || false,
        is_replacement: assignment.is_replacement || false,
        replacement_id: replacementId,
        replacement_order: assignment.replacement_order || 1,
        is_acting_lieutenant: assignment.is_acting_lieutenant || false,
        is_acting_captain: assignment.is_acting_captain || false,
        replaced_first_name: replacedFF?.first_name || replacedFromTeam?.first_name || "Pompier",
        replaced_last_name: replacedFF?.last_name || replacedFromTeam?.last_name || "Inconnu",
        replaced_position_code: replacedFF?.position_code || replacedFromTeam?.position_code || "", // Use stored position_code
        leave_bank_1: assignment.leave_bank_1,
        leave_hours_1: assignment.leave_hours_1,
        leave_bank_2: assignment.leave_bank_2,
        leave_hours_2: assignment.leave_hours_2,
        shift_id: shift.id, // Added shift_id for handleRemoveDirectAssignment
      })
    }
  })

  assignedReplacements.forEach((r: any) => {
    const approvedApp = r.applications.find((app: any) => app.status === "approved")
    const replacementKey = `${approvedApp.applicant_id}_${r.user_id}`

    // Skip if this replacement already exists in currentAssignments
    if (existingReplacementKeys.has(replacementKey)) {
      return
    }

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
      replaced_first_name: replacedFF?.first_name || r.first_name,
      replaced_last_name: replacedFF?.last_name || r.last_name,
      replaced_position_code: replacedFF?.position_code || "",
      leave_bank_1: r.leave_bank_1,
      leave_hours_1: r.leave_hours_1,
      leave_bank_2: r.leave_bank_2,
      leave_hours_2: r.leave_hours_2,
      shift_id: shift.id, // Added shift_id for handleRemoveDirectAssignment
    })
  })

  replacements.forEach((r: any) => {
    // Skip if already processed (has approved application)
    const hasApprovedApp = r.applications?.some((app: any) => app.status === "approved")
    if (hasApprovedApp) {
      return
    }

    if (!groupedReplacements.has(r.user_id)) {
      groupedReplacements.set(r.user_id, [])
    }

    const replacedFF = allFirefighters?.find((ff) => ff.id === r.user_id)

    // For extra firefighters (user_id is null), generate the name with number
    const extraFightersForShift = replacements.filter((rep: any) => rep.user_id === null && rep.shift_date === r.shift_date && rep.shift_type === r.shift_type && rep.team_id === r.team_id)
    const extraNumber = extraFightersForShift.findIndex((rep: any) => rep.id === r.id) + 1

    groupedReplacements.get(r.user_id)!.push({
      user_id: null,
      first_name: "Pompier",
      last_name: `supplémentaire ${extraNumber}`,
      role: null,
      email: null,
      start_time: r.start_time,
      end_time: r.end_time,
      is_partial: r.is_partial,
      is_replacement: false,
      is_direct_assignment: false,
      replacement_id: r.id,
      replacement_order: 0,
      is_acting_lieutenant: false,
      is_acting_captain: false,
      replaced_first_name: replacedFF?.first_name || r.first_name,
      replaced_last_name: replacedFF?.last_name || r.last_name,
      replaced_position_code: replacedFF?.position_code || "",
      leave_bank_1: r.leave_bank_1,
      leave_hours_1: r.leave_hours_1,
      leave_bank_2: r.leave_bank_2,
      leave_hours_2: r.leave_hours_2,
      applications: r.applications,
      status: r.status,
      shift_id: shift.id, // Added shift_id for handleRemoveDirectAssignment
    })
  })

  // BUT only if they are NOT permanent team members
  const replacementUserIdsToHide = useMemo(() => {
    const ids = new Set<number>()
    groupedReplacements.forEach((replacements) => {
      replacements.forEach((r) => {
        if (r.user_id && !permanentTeamMemberIds.has(r.user_id)) {
          ids.add(r.user_id)
        }
      })
    })
    return ids
  }, [groupedReplacements.size, permanentTeamMemberIds])

  const { displayedAssignments } = useMemo(() => {
    const permanentMemberIds = new Set<number>()
    currentAssignments?.forEach((assignment) => {
      permanentMemberIds.add(assignment.user_id)
    })

    const assignments = (currentAssignments || [])
      .filter((assignment) => {
        // Skip manually removed extra firefighters
        if (removedExtraFirefighters.includes(assignment.user_id)) {
          return false
        }

        // Skip if this is a placeholder created for removed firefighter
        if (assignment.replaced_user_id) {
          return false
        }

        // BUT only hide them if they are NOT a permanent team member
        let isReplacementOnly = false
        for (const replacements of groupedReplacements.values()) {
          // Check against all possible replacement orders (0, 1, 2)
          const replacement0 = replacements.find((r) => r.replacement_order === 0)
          const replacement1 = replacements.find((r) => r.replacement_order === 1)
          const replacement2 = replacements.find((r) => r.replacement_order === 2)

          if (
            replacement0?.user_id === assignment.user_id ||
            replacement1?.user_id === assignment.user_id ||
            replacement2?.user_id === assignment.user_id
          ) {
            if (!permanentMemberIds.has(assignment.user_id)) {
              isReplacementOnly = true
              break
            }
          }
        }

        if (isReplacementOnly) {
          return false
        }

        // Exclude extra firefighters who were removed (this might be redundant with removedExtraFirefighters)
        if (replacementUserIdsToHide.has(assignment.user_id)) {
          return false
        }

        return true
      })
      .map((assignment) => {
        return {
          ...assignment,
          name: `${assignment.first_name} ${assignment.last_name}`,
        }
      })
      .sort((a, b) => {
        // Position code sorting
        const posA = a.position_code || ""
        const posB = b.position_code || ""
        return posA.localeCompare(posB)
      })

    return { displayedAssignments: assignments }
  }, [
    currentAssignments,
    removedExtraFirefighters,
    groupedReplacements.size,
    shift?.team_members,
    replacementUserIdsToHide,
    // permanentMemberIds, // Removed permanentMemberIds from dependency array since it's a local variable
  ]) // Added shift.team_members to dependency array

  const getExchangeForFirefighter = (firefighterId: number, firstName: string, lastName: string, role: string) => {
    if (!shift?.exchanges) return null

    return shift.exchanges.find((ex: any) => {
      if (ex.type === "requester") {
        return (
          ex.requester_first_name === firstName && ex.requester_last_name === lastName && ex.requester_role === role
        )
      } else {
        return ex.target_first_name === firstName && ex.target_last_name === lastName && ex.target_role === role
      }
    })
  }

  const handleDeadlineChange = (selectedValue: number | null | Date | null) => {
    if (selectedValue === -1) {
      setDeadlineSeconds(-1) // Explicitly set to -1 for "no deadline"
    } else if (typeof selectedValue === "number") {
      setDeadlineSeconds(selectedValue)
    } else {
      setDeadlineSeconds(null) // Handle null or Date objects
    }
  }

  if (!shift) {
    return null
  }

  // Helper to find replacement details by order
  const getReplacementByOrder = (firefighterId: number, order: number) => {
    const replacementsForUser = groupedReplacements.get(firefighterId) || []
    return replacementsForUser.find((r) => r.replacement_order === order)
  }

  // Define replacement0, replacement1, replacement2 here, derived from getReplacementByOrder
  const getReplacementDetails = (firefighterId: number) => {
    const replacement0 = getReplacementByOrder(firefighterId, 0)
    const replacement1 = getReplacementByOrder(firefighterId, 1)
    const replacement2 = getReplacementByOrder(firefighterId, 2)
    return { replacement0, replacement1, replacement2 }
  }

  // This is the function that was redeclared and caused the lint error.
  // The original implementation was correct and is kept below.
  // The duplicate definition has been removed.
  const handleRemoveReplacementAssignment_updated = async (replacementId: number, assignedName: string) => {
    console.log("[v0] handleRemoveReplacementAssignment_updated CALLED", { replacementId, assignedName })
    try {
      setLoadingReplacements(true)

      const result = await removeReplacementAssignment(replacementId)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(`Assignation retirée: ${assignedName}`)

      const shiftDate = formatDateForDB(shift.date)
      const data = await getReplacementsForShift(shiftDate, shift.shift_type, shift.team_id)
      setReplacements(data)

      await loadData()
    } catch (error) {
      console.error("Error removing replacement assignment:", error)
      toast.error("Une erreur est survenue")
    } finally {
      setLoadingReplacements(false)
    }
  }

  return (
    <>
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
                {shift.start_time && shift.end_time
                  ? `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`
                  : "Horaire non défini"}
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                {(teamFirefighters || []).length} pompiers
              </div>
            </div>
          </SheetHeader>

          <div className="mt-4">
            <Button
              onClick={() => {
                setExtraRequestMode("request") // Ensure mode is "request" when opening
                setShowExtraDialog(true)
              }}
              disabled={isLoading || loadingReplacements}
              className="w-full"
              variant="outline"
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Ajouter un pompier supplémentaire
            </Button>
          </div>

          <div className="mt-6 space-y-3">
            {/* Add key to force re-render when replacements change */}
            <div
              key={refreshKey} // Use refreshKey here
            >
              {currentAssignments && currentAssignments.length > 0 ? (
                Array.from(
                  new Map(
                    currentAssignments
                      .filter((assignment) => {
                        // Permanent team members are NOT filtered out even if they replace someone
                        const isExternalReplacement = replacementUserIdsToHide.has(assignment.user_id)
                        
                        // Hide replacements that already appear in replaced firefighter's card
                        const isReplacementWithReplacedUser = assignment.is_replacement === true && assignment.replaced_user_id

                        return (
                          !assignment.is_replacement &&
                          !(assignment.is_direct_assignment && assignment.replaced_user_id) &&
                          !isExternalReplacement &&
                          !isReplacementWithReplacedUser
                        )
                      })
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
                    const replacementsForUser = groupedReplacements.get(firefighter.id) || []
                    const hasReplacements = replacementsForUser.length > 0

                    // Skip if this firefighter is a replacement with a replaced user (already shown in replaced user's card)
                    const isReplacementWithReplacedUser = currentAssignments.some(
                      (a) => a.user_id === firefighter.id && a.replaced_user_id,
                    )
                    
                    if (isReplacementWithReplacedUser) {
                      return null
                    }

                    const { replacement0, replacement1, replacement2 } = getReplacementDetails(firefighter.id)

                    // console.log("[v0] Drawer - replacement details for firefighter", firefighter.id, {
                    //   replacement0: replacement0
                    //     ? {
                    //         user_id: replacement0.user_id,
                    //         first_name: replacement0.first_name,
                    //         last_name: replacement0.last_name,
                    //         replacement_order: replacement0.replacement_order,
                    //       }
                    //     : null,
                    //   replacement1: replacement1
                    //     ? {
                    //         user_id: replacement1.user_id,
                    //         first_name: replacement1.first_name,
                    //         last_name: replacement1.last_name,
                    //         replacement_order: replacement1.replacement_order,
                    //       }
                    //     : null,
                    //   replacement2: replacement2
                    //     ? {
                    //         user_id: replacement2.user_id,
                    //         first_name: replacement2.first_name,
                    //         last_name: replacement2.last_name,
                    //         replacement_order: replacement2.replacement_order,
                    //       }
                    //     : null,
                    // })

                    if (hasReplacements) {
                      const bankInfo = replacement0 || replacement1 || replacement2

                      return (
                        <Card key={`replaced-${firefighter.id}`} className="border-green-300 bg-green-50/30">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium truncate">
                                    {firefighter.first_name} {firefighter.last_name}
                                  </p>
                                </div>

                                {(() => {
                                  if (!bankInfo) {
                                    return null
                                  }

                                  const hasBanks = bankInfo.leave_bank_1 || bankInfo.leave_bank_2

                                  if (!hasBanks) {
                                    return null
                                  }

                                  const bankLabels: Record<string, string> = {
                                    fete_chomee: "Fête chômée",
                                    vacances: "Vacances",
                                    maladie: "Maladie",
                                    reconnaissance: "Reconnaissance",
                                    modulation: "Modulation",
                                    arret_travail: "Arrêt de travail",
                                    formation: "Formation",
                                    conge_social: "Congé social",
                                  }

                                  return (
                                    <div className="mt-2 pt-2 border-t">
                                      {/* Changed text-xs to text-[11px] and added underline to match "Remplaçant X" style */}
                                      <p className="text-[11px] font-medium text-muted-foreground mb-1 underline">
                                        Banque de congé
                                      </p>
                                      <div className="text-xs space-y-0.5">
                                        {bankInfo.leave_bank_1 && (
                                          <div>
                                            • {bankLabels[bankInfo.leave_bank_1] || bankInfo.leave_bank_1}
                                            {bankInfo.leave_hours_1 && ` (${bankInfo.leave_hours_1}h)`}
                                          </div>
                                        )}
                                        {bankInfo.leave_bank_2 && (
                                          <div>
                                            • {bankLabels[bankInfo.leave_bank_2] || bankInfo.leave_bank_2}
                                            {bankInfo.leave_hours_2 && ` (${bankInfo.leave_hours_2}h)`}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>

                              <div className="mt-2 space-y-2">
                                {replacement0 && !replacement1 && isAdmin && (
                                  <div className="flex items-center gap-2 mt-2">
                                    {replacement0.applications && replacement0.applications.length > 0 && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          router.push(`/dashboard/replacements/${replacement0.replacement_id}`)
                                        }}
                                      >
                                        Voir les candidats ({replacement0.applications.length})
                                      </Button>
                                    )}

                                    <AddManualApplicationDialog
                                      replacementId={replacement0.replacement_id}
                                      availableFirefighters={allFirefighters || []}
                                      existingApplicantIds={
                                        replacement0.applications?.map((app: any) => app.user_id) || []
                                      }
                                      onSuccess={loadData}
                                      trigger={
                                        <Button variant="default" size="icon" className="h-8 w-8">
                                          <UserPlus className="h-4 w-4" />
                                        </Button>
                                      }
                                    />

                                    <DeleteReplacementButton
                                      replacementId={replacement0.replacement_id}
                                      onSuccess={loadData}
                                      hasAssignedCandidate={!!replacement0.user_id}
                                      variant="destructive"
                                      size="icon"
                                      className="h-8 w-8"
                                    />
                                  </div>
                                )}

                                {replacement1 && (
                                  <div className="space-y-2">
                                    <div className="space-y-1">
                                      <div className="text-[11px] text-muted-foreground font-medium underline">
                                        {replacement2 ? "Remplaçant 1" : "Remplaçant"}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[13px] text-orange-600 font-medium truncate">
                                          {replacement1.first_name} {replacement1.last_name}
                                          {(() => {
                                            const allR1Periods = replacementsForUser.filter(
                                              (r) => r.replacement_order === 1,
                                            )

                                            if (allR1Periods.length > 1) {
                                              // Multiple periods - R2 is in the middle
                                              const timeRanges = allR1Periods
                                                .map((period) => {
                                                  if (period.start_time && period.end_time) {
                                                    return `${period.start_time.slice(0, 5)}-${period.end_time.slice(0, 5)}`
                                                  }
                                                  return null
                                                })
                                                .filter(Boolean)
                                                .join(", ")

                                              return timeRanges ? (
                                                <span className="text-[11px]"> ({timeRanges})</span>
                                              ) : (
                                                <span className="text-[11px]"> (Quart complet)</span>
                                              )
                                            }

                                            // Single period - normal display
                                            if (replacement1.start_time && replacement1.end_time) {
                                              // Only show times if it's a partial replacement
                                              if (replacement1.is_partial) {
                                                return (
                                                  <span className="text-[11px]">
                                                    {" "}
                                                    ({replacement1.start_time.slice(0, 5)}-
                                                    {replacement1.end_time.slice(0, 5)})
                                                  </span>
                                                )
                                              }
                                              // For full shifts, show "Quart complet" even if times exist
                                              return <span className="text-[11px]"> (Quart complet)</span>
                                            }
                                            return <span className="text-[11px]"> (Quart complet)</span>
                                          })()}
                                        </span>

                                        {replacement1.is_direct_assignment && (
                                          <span
                                            className="text-orange-500 text-lg flex-shrink-0"
                                            title="Assignation directe"
                                          >
                                            ⚡
                                          </span>
                                        )}

                                        {isAdmin && replacement1.replacement_id && (
                                          <DeleteReplacementButton
                                            replacementId={replacement1.replacement_id}
                                            onSuccess={loadData}
                                            hasAssignedCandidate={!!replacement1.user_id}
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                          />
                                        )}
                                        {isAdmin && !replacement1.replacement_id && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleRemoveReplacement1(firefighter.id)}
                                            disabled={isLoading || loadingReplacements}
                                            className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 bg-transparent flex-shrink-0"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>

                                    {isAdmin && replacement1.user_id && (
                                      <div className="grid grid-cols-2 gap-2">
                                        {replacement1.is_acting_lieutenant ? (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              handleRemoveLieutenant(
                                                replacement1.user_id,
                                                `${replacement1.first_name} ${replacement1.last_name}`,
                                              )
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
                                              handleSetLieutenant(
                                                replacement1.user_id,
                                                `${replacement1.first_name} ${replacement1.last_name}`,
                                              )
                                            }
                                            disabled={isLoading || loadingReplacements}
                                            className="text-cyan-600 hover:bg-cyan-50"
                                          >
                                            Désigner Lt
                                          </Button>
                                        )}
                                        {replacement1.is_acting_captain ? (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              handleRemoveCaptain(
                                                replacement1.user_id,
                                                `${replacement1.first_name} ${replacement1.last_name}`,
                                              )
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
                                              handleSetCaptain(
                                                replacement1.user_id,
                                                `${replacement1.first_name} ${replacement1.last_name}`,
                                              )
                                            }
                                            disabled={isLoading || loadingReplacements}
                                            className="text-cyan-600 hover:bg-cyan-50"
                                          >
                                            Désigner Cpt
                                          </Button>
                                        )}
                                      </div>
                                    )}

                                    {!replacement2 && (
                                      <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                                        <button
                                          onClick={() => {
                                            setSelectedFirefighter(firefighter)
                                            setReplacementOrder(2)
                                            setShowDirectAssignmentDialog(true)
                                          }}
                                          disabled={isLoading || loadingReplacements}
                                          className="text-[11px] text-muted-foreground hover:text-cyan-600 font-medium underline underline-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          + Remplaçant 2
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {replacement2 && (
                                  <div className="space-y-1">
                                    <div className="text-[11px] text-muted-foreground font-medium underline">
                                      {replacement1 ? "Remplaçant 2" : "Remplaçant"}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[13px] text-orange-600 font-medium truncate">
                                        {replacement2.first_name} {replacement2.last_name}
                                        {replacement2.start_time && replacement2.end_time && (
                                          <span className="text-[11px]">
                                            {" "}
                                            ({replacement2.start_time.slice(0, 5)}-{replacement2.end_time.slice(0, 5)})
                                          </span>
                                        )}
                                      </span>

                                      {replacement2.is_direct_assignment && (
                                        <span
                                          className="text-orange-500 text-lg flex-shrink-0"
                                          title="Assignation directe"
                                        >
                                          ⚡
                                        </span>
                                      )}

                                      {isAdmin && replacement2.replacement_id && (
                                        <DeleteReplacementButton
                                          replacementId={replacement2.replacement_id}
                                          onSuccess={loadData}
                                          hasAssignedCandidate={!!replacement2.user_id}
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                        />
                                      )}
                                      {isAdmin && !replacement2.replacement_id && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleRemoveReplacement2(firefighter.id)}
                                          disabled={isLoading || loadingReplacements}
                                          className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 bg-transparent flex-shrink-0"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}
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

                      const isExtraRequest =
                        assignment.first_name === "Pompier" && assignment.last_name === "supplémentaire"

                      const replacement = !loadingReplacements
                        ? isExtraRequest
                          ? getReplacementForExtraFirefighter()
                          : getReplacementForFirefighter(firefighterId)
                        : null
                      const hasReplacement = !!replacement

                      const isReplacementFirefighter = assignment.is_replacement === true

                      const firefighterLeave = getFirefighterLeaveForDate(assignment.user_id, shift.date, leaves)
                      const hasPartialLeave =
                        firefighterLeave && firefighterLeave.start_time && firefighterLeave.end_time

                      const hasPartialReplacement =
                        replacement?.is_partial && replacement?.start_time && replacement?.end_time

                      const exchange = getExchangeForFirefighter(
                        assignment.user_id,
                        assignment.first_name,
                        assignment.last_name,
                        assignment.role,
                      )
                      const hasExchange = !!exchange

                      const displayName = isExtraRequest
                        ? `${assignment.first_name} ${assignment.last_name}` // Use stored name which includes number (e.g., "Pompier supplémentaire 1")
                        : assignment.name || `${assignment.first_name} ${assignment.last_name}`

                      let exchangePartner = null
                      let exchangePartialTimes = null
                      let exchangeShiftInfo = ""

                      if (hasExchange) {
                        if (exchange.type === "requester") {
                          // Current firefighter IS the requester → show the target
                          exchangePartner = `${exchange.target_first_name} ${exchange.target_last_name}`
                          if (exchange.is_partial && exchange.requester_start_time && exchange.requester_end_time) {
                            exchangePartialTimes = `${exchange.requester_start_time.slice(0, 5)}-${exchange.requester_end_time.slice(0, 5)}`
                          }
                          // Format the date and type of the shift that will be worked
                          const targetDate = new Date(exchange.target_shift_date)
                          // Add 1 day to compensate for timezone issue in production
                          targetDate.setDate(targetDate.getDate() + 1)
                          const formattedDate = targetDate
                            .toLocaleDateString("fr-CA", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                            .replace(".", "")
                          exchangeShiftInfo = ` (${formattedDate} - ${translateShiftType(exchange.target_shift_type)})`
                        } else {
                          // Current firefighter IS the target → show the requester
                          exchangePartner = `${exchange.requester_first_name} ${exchange.requester_last_name}`
                          if (exchange.is_partial && exchange.target_start_time && exchange.target_end_time) {
                            exchangePartialTimes = `${exchange.target_start_time.slice(0, 5)}-${exchange.target_end_time.slice(0, 5)}`
                          }
                          // Format the date and type of the shift that will be worked
                          const requesterDate = new Date(exchange.requester_shift_date)
                          // Add 1 day to compensate for timezone issue in production
                          requesterDate.setDate(requesterDate.getDate() + 1)
                          const formattedDate = requesterDate
                            .toLocaleDateString("fr-CA", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                            .replace(".", "")
                          exchangeShiftInfo = ` (${formattedDate} - ${translateShiftType(exchange.requester_shift_type)})`
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
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <p className="font-medium truncate">{displayName}</p>
                                  {assignment.is_extra && !isExtraRequest && (
                                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] px-1.5 py-0">
                                      Supplémentaire
                                    </Badge>
                                  )}
                                  {isExtraRequest && (
                                    <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-[10px] px-1.5 py-0">
                                      <span className="text-orange-700 mr-1">?</span>
                                      Demande en cours
                                    </Badge>
                                  )}
                                  {assignment.is_extra &&
                                    assignment.is_partial &&
                                    assignment.start_time &&
                                    assignment.end_time && (
                                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] px-1.5 py-0 truncate max-w-full">
                                        Partiel: {assignment.start_time.slice(0, 5)} - {assignment.end_time.slice(0, 5)}
                                      </Badge>
                                    )}
                                  {isReplacementFirefighter && (
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] px-1.5 py-0">
                                      <span className="text-green-700 mr-1">✓</span>
                                      Remplaçant
                                    </Badge>
                                  )}
                                  {isDirectAssignment && (
                                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px] px-1.5 py-0">
                                      <Zap className="h-3 w-3 mr-1" /> Assignation directe
                                    </Badge>
                                  )}
                                  {isDirectAssignment &&
                                    assignment.is_partial &&
                                    assignment.start_time &&
                                    assignment.end_time && (
                                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px] px-1.5 py-0 truncate max-w-full">
                                        Partiel: {assignment.start_time.slice(0, 5)} - {assignment.end_time.slice(0, 5)}
                                      </Badge>
                                    )}
                                </div>
                                {isReplacementFirefighter && assignment.replaced_first_name && (
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    Remplace {assignment.replaced_first_name} {assignment.replaced_last_name}
                                  </p>
                                )}
                                {isDirectAssignment && assignment.replaced_name && (
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    Remplace {assignment.replaced_name}
                                  </p>
                                )}
                                {hasExchange && (
                                  <div className="mt-1.5">
                                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-[10px] px-1.5 py-0 truncate max-w-full">
                                      ↔ Échange avec {exchangePartner}
                                      {exchangeShiftInfo}
                                      {exchangePartialTimes && ` • ${exchangePartialTimes}`}
                                    </Badge>
                                  </div>
                                )}
                                {hasPartialLeave && (
                                  <div className="mt-1.5">
                                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px] px-1.5 py-0">
                                      Congé partiel: {firefighterLeave.start_time?.slice(0, 5) || "N/A"} -{" "}
                                      {firefighterLeave.end_time?.slice(0, 5) || "N/A"}
                                    </Badge>
                                  </div>
                                )}
                                {hasPartialReplacement && (
                                  <div className="mt-1.5">
                                    <Badge
                                      className={`${
                                        replacement.status === "assigned"
                                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                          : replacement.status === "pending"
                                            ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                      } text-[10px] px-1.5 py-0`}
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
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] px-1.5 py-0">
                                      <span className="text-green-700 mr-1">✓</span>
                                      Remplacé par {assignedFirefighterName}
                                    </Badge>
                                    {isAdmin && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleRemoveReplacementAssignment_updated(
                                            replacement.id,
                                            assignedFirefighterName,
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
                                {hasReplacement && (
                                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                    {!isReplacementAssigned && (
                                      <ApplyForReplacementButton
                                        replacementId={replacement.id}
                                        isAdmin={isAdmin}
                                        firefighters={allFirefighters}
                                        onSuccess={refreshReplacements}
                                      />
                                    )}
                                    {isAdmin &&
                                      replacement &&
                                      replacement.applications &&
                                      replacement.applications.length > 0 && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            router.push(`/dashboard/replacements/${replacement.id}`)
                                          }}
                                          className="text-foreground hover:bg-gray-50 h-8 text-xs"
                                        >
                                          <Users className="h-4 w-4 mr-1" />
                                          Voir les candidats ({replacement.applications.length})
                                        </Button>
                                      )}
                                    {isAdmin && (
                                      <DeleteReplacementButton
                                        replacementId={replacement.id}
                                        onSuccess={() => {
                                          if (typeof window !== "undefined") {
                                            const scrollPos = window.scrollY
                                            // console.log(
                                            //   "[v0] Drawer - saving scroll before DeleteReplacementButton:",
                                            //   scrollPos,
                                            // )
                                            sessionStorage.setItem("calendar-scroll-position", scrollPos.toString())
                                            sessionStorage.setItem("skip-scroll-to-today", "true")
                                          }
                                          refreshAndClose()
                                        }}
                                      />
                                    )}
                                    {/* Button to add manual application </CHANGE> */}
                                    {isAdmin && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedReplacementId(replacement.id)
                                          setShowAddManualApplicationDialog(true)
                                        }}
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 text-xs"
                                      >
                                        <UserPlus className="h-4 w-4 mr-1" />
                                        Ajouter candidat
                                      </Button>
                                    )}
                                  </div>
                                )}

                                {isDirectAssignment && isAdmin && (
                                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleRemoveDirectAssignment(
                                          assignment.shift_id, // Use assignment.shift_id
                                          assignment.user_id,
                                          assignment.replacement_order,
                                        )
                                      } // Pass replacement_order
                                      disabled={isLoading || loadingReplacements}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Retirer
                                    </Button>
                                    {/* Lt/Cpt buttons moved to shared section below */}
                                  </div>
                                )}
                                {!isReplacementFirefighter &&
                                  !isDirectAssignment &&
                                  !assignment.is_extra &&
                                  isAdmin && (
                                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
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
                                            className="text-orange-600 hover:bg-orange-50 h-8 text-xs"
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
                                            className="text-orange-600 hover:bg-orange-50 h-8 text-xs"
                                          >
                                            Assigner directement
                                          </Button>
                                        </>
                                      )}
                                      {/* Lt/Cpt buttons moved to shared section below */}
                                    </div>
                                  )}
                                {/* Lt/Cpt buttons for ALL firefighters (including replacements and direct assignments) */}
                                {isAdmin && !isExtraRequest && (
                                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                                    {assignment.is_acting_lieutenant ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleRemoveLieutenant(assignment.user_id || assignment.id, displayName)
                                        }
                                        disabled={isLoading || loadingReplacements}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
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
                                        className="text-cyan-600 hover:bg-cyan-50 h-8 text-xs"
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
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
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
                                        className="text-cyan-600 hover:bg-cyan-50 h-8 text-xs"
                                      >
                                        Désigner Cpt
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {assignment.is_extra && !isExtraRequest && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRemoveExtraFirefighter(assignment.user_id, displayName)}
                                    disabled={isLoading || loadingReplacements}
                                    className="text-red-600 hover:text-red-600 hover:bg-red-50 h-8 w-8"
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
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <p className="font-medium truncate">
                                  {firefighter.first_name} {firefighter.last_name}
                                </p>
                              </div>
                              {isAdmin && (
                                <div className="grid grid-cols-2 gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedFirefighter(firefighter)}
                                    disabled={isLoading || loadingReplacements}
                                    className="text-orange-600 hover:bg-orange-50 h-8 text-xs"
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
                                    className="text-orange-600 hover:bg-orange-50 h-8 text-xs"
                                  >
                                    Assigner directement
                                  </Button>
                                </div>
                              )}
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
            {/* End of changed section */}

            {/* Display ALL extra firefighters separately */}
            {!loadingReplacements && getAllReplacementsForExtraFirefighters().length > 0 && (
              <div className="space-y-2 mt-6 pt-4 border-t">
                <p className="text-sm font-semibold text-muted-foreground px-3">Pompiers supplémentaires</p>
                {getAllReplacementsForExtraFirefighters().map((replacement) => {
                  const firefighterName = `${replacement.first_name} ${replacement.last_name}`
                  
                  return (
                    <Card key={`extra-${replacement.id}`} className="border-blue-200 bg-blue-50/20">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-medium text-blue-700">{firefighterName}</p>
                            {replacement.is_partial && replacement.start_time && replacement.end_time && (
                              <p className="text-xs text-muted-foreground">
                                {replacement.start_time.slice(0, 5)} - {replacement.end_time.slice(0, 5)}
                              </p>
                            )}
                            {replacement.status && (
                              <p className="text-xs text-muted-foreground">
                                Statut: {getStatusLabel(replacement.status)}
                              </p>
                            )}
                          </div>
                          {isAdmin && replacement.id && (
                            <DeleteReplacementButton
                              replacementId={replacement.id}
                              onSuccess={loadData}
                              hasAssignedCandidate={!!replacement.user_id}
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
            {/* Use displayedAssignments to check if it's empty */}
            {displayedAssignments.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Aucun pompier assigné à ce quart</p>
                </CardContent>
              </Card>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!selectedFirefighter && !showDeadlineWarning && !showDirectAssignmentDialog}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedFirefighter(null)
            setIsPartial(false)
            setDeadlineSeconds(null)
            // Reset partial times and leave banks when dialog closes
            setPartialStartTime(getDefaultReplacementTimes(shift?.shift_type).startTime)
            setPartialEndTime(getDefaultReplacementTimes(shift?.shift_type).endTime)
            setLeaveBank1("")
            setLeaveHours1("")
            setLeaveBank2("")
            setLeaveHours2("")
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
                shiftEndTime={isPartial ? partialEndTime : shift.end_time}
                partialEndTime={isPartial ? partialEndTime : undefined}
                isPartial={isPartial}
                shift={shift}
              />
            )}

            <LeaveBankSelector
              bank1={leaveBank1}
              hours1={leaveHours1}
              bank2={leaveBank2}
              hours2={leaveHours2}
              onBank1Change={setLeaveBank1}
              onHours1Change={setLeaveHours1}
              onBank2Change={setLeaveBank2}
              onHours2Change={setLeaveHours2}
            />

            <div className="flex items-center space-x-2">
              <Checkbox
                id="partial"
                checked={isPartial}
                onCheckedChange={(checked) => {
                  setIsPartial(checked === true)
                  // Reset times if switching off partial
                  if (checked !== true) {
                    setPartialStartTime(getDefaultReplacementTimes(shift?.shift_type).startTime)
                    setPartialEndTime(getDefaultReplacementTimes(shift?.shift_type).endTime)
                  }
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
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">Heures du quart</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="start-time" className="text-xs text-muted-foreground">
                      Début
                    </Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={partialStartTime}
                      onChange={(e) => setPartialStartTime(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end-time" className="text-xs text-muted-foreground">
                      Fin
                    </Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={partialEndTime}
                      onChange={(e) => setPartialEndTime(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateReplacement}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? "Création..." : "Créer la demande"}
            </Button>
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
              Choisissez comment ajouter un pompier supplémentaire pour ce quart.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            {shift && (
              <DeadlineSelect
                value={extraDeadlineSeconds}
                onValueChange={handleExtraDeadlineChange}
                shiftDate={shift.date}
                shiftEndTime={isExtraPartial ? extraEndTime : shift.end_time}
                partialEndTime={isExtraPartial ? extraEndTime : undefined}
                isPartial={isExtraPartial}
                shift={shift}
              />
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
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">Heures du quart</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="extra-start" className="text-xs text-muted-foreground">
                      Début
                    </Label>
                    <Input
                      id="extra-start"
                      type="time"
                      value={extraStartTime}
                      onChange={(e) => setExtraStartTime(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="extra-end" className="text-xs text-muted-foreground">
                      Fin
                    </Label>
                    <Input
                      id="extra-end"
                      type="time"
                      value={extraEndTime}
                      onChange={(e) => setExtraEndTime(e.target.value)}
                      className="text-sm"
                    />
                  </div>
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
                setExtraRequestMode(null) // Reset the mode
                const times = getDefaultReplacementTimes(shift?.shift_type)
                setExtraStartTime(times.startTime)
                setExtraEndTime(times.endTime)
              }}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAddExtraFirefighter}
              disabled={
                isLoading ||
                extraDeadlineSeconds === null ||
                extraDeadlineSeconds === 0 ||
                (isExtraPartial && extraStartTime >= extraEndTime)
              }
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? "Création..." : "Créer la demande"}
            </Button>
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
                setExtraRequestMode(null) // Reset the mode
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
        onSuccess={loadData}
        preSelectedFirefighter={selectedFirefighter}
        replacementOrder={replacementOrder}
      />

      {/* Direct Assignment Dialog for pending replacements */}
      {shift && selectedReplacementForAssignment && (
        <DirectAssignmentDialog
          open={showDirectAssignment}
          onOpenChange={(isOpen) => {
            setShowDirectAssignment(isOpen)
            if (!isOpen) {
              setSelectedReplacementForAssignment(null)
            }
          }}
          shift={shift}
          teamFirefighters={teamFirefighters}
          allFirefighters={allFirefighters}
          onSuccess={() => {
            setShowDirectAssignment(false)
            setSelectedReplacementForAssignment(null)
            refreshAndClose()
          }}
          initialReplacementId={selectedReplacementForAssignment}
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

      <EmailSendResultsModal
        open={showEmailResults}
        onOpenChange={setShowEmailResults}
        results={emailResults}
        onRetry={async () => {
          // Close modal for now - retry functionality can be added later
          setShowEmailResults(false)
        }}
      />

      {/* Applications Dialog */}
      {shift && selectedReplacementId && (
        <AlertDialog
          open={showApplicationsDialog}
          onOpenChange={(isOpen) => {
            setShowApplicationsDialog(isOpen)
            if (!isOpen) {
              setSelectedReplacementId(null)
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Candidatures pour le remplacement</AlertDialogTitle>
              <AlertDialogDescription>Voici les candidats qui ont postulé pour ce remplacement.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              {(() => {
                const replacement = replacements.find((r) => r.id === selectedReplacementId)
                if (!replacement || !replacement.applications) {
                  return <p>Aucune candidature trouvée.</p>
                }
                const approvedApp = replacement.applications.find((app: any) => app.status === "approved")
                const rejectedApps = replacement.applications.filter((app: any) => app.status === "rejected")
                const pendingApps = replacement.applications.filter((app: any) => app.status === "pending")

                return (
                  <div className="space-y-3">
                    {approvedApp && (
                      <Card className="border-green-300 bg-green-50/30">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <p className="font-medium">
                                {approvedApp.first_name} {approvedApp.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">{approvedApp.email}</p>
                            </div>
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                              Approuvé
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {pendingApps.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium mb-2">En attente:</h3>
                        <div className="space-y-2">
                          {pendingApps.map((app: any) => (
                            <Card key={app.id} className="border-gray-300 bg-gray-50/30">
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1">
                                    <p className="font-medium">
                                      {app.first_name} {app.last_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{app.email}</p>
                                  </div>
                                  <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 text-xs">
                                    En attente
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                    {rejectedApps.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium mb-2">Rejeté:</h3>
                        <div className="space-y-2">
                          {rejectedApps.map((app: any) => (
                            <Card key={app.id} className="border-red-300 bg-red-50/30">
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1">
                                    <p className="font-medium">
                                      {app.first_name} {app.last_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{app.email}</p>
                                  </div>
                                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">
                                    Rejeté
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setShowApplicationsDialog(false)}>
                Fermer
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* AddManualApplicationDialog */}
      {shift && selectedReplacementId && (
        <AddManualApplicationDialog
          open={showAddManualApplicationDialog}
          onOpenChange={(isOpen) => {
            setShowAddManualApplicationDialog(isOpen)
            if (!isOpen) {
              setSelectedReplacementId(null)
            }
          }}
          replacementId={selectedReplacementId}
          allFirefighters={allFirefighters}
          onSuccess={() => {
            setShowAddManualApplicationDialog(false)
            setSelectedReplacementId(null)
            refreshReplacements() // Refresh replacements list to show the new candidate
          }}
        />
      )}
    </>
  )
}
