"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown, Zap, Trash2 } from "lucide-react"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { parseLocalDate, formatShortDate, formatCreatedAt } from "@/lib/date-utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { compareShifts } from "@/lib/shift-sort"
import { PartTimeTeamBadge } from "@/components/part-time-team-badge"
import { removeDirectAssignment } from "@/app/actions/direct-assignments"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
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

interface DirectAssignmentsTabProps {
  directAssignments: any[]
  isAdmin: boolean
}

export function DirectAssignmentsTab({ directAssignments, isAdmin }: DirectAssignmentsTabProps) {
  const [sortBy, setSortBy] = useState<"date" | "created_at" | "replaced" | "assigned">("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [showPastAssignments, setShowPastAssignments] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [assignmentToDelete, setAssignmentToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  console.log("[v0] DirectAssignmentsTab - Total directAssignments:", directAssignments.length)
  console.log("[v0] DirectAssignmentsTab - First 3 assignments:", directAssignments.slice(0, 3))
  console.log("[v0] DirectAssignmentsTab - showPastAssignments:", showPastAssignments)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  console.log("[v0] DirectAssignmentsTab - Today date:", today)

  const filteredAssignments = directAssignments.filter((assignment) => {
    if (showPastAssignments) return true
    const assignmentDate = parseLocalDate(assignment.shift_date)
    console.log(
      "[v0] Comparing:",
      assignment.shift_date,
      "parsed:",
      assignmentDate,
      "vs today:",
      today,
      "isPast:",
      assignmentDate < today,
    )
    return assignmentDate >= today
  })

  console.log("[v0] DirectAssignmentsTab - Filtered assignments:", filteredAssignments.length)

  const sortedAssignments = [...filteredAssignments].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case "date":
        comparison = compareShifts(a, b, parseLocalDate)
        break
      case "created_at":
        const dateA = a.assigned_at ? new Date(a.assigned_at).getTime() : 0
        const dateB = b.assigned_at ? new Date(b.assigned_at).getTime() : 0
        comparison = dateA - dateB
        break
      case "replaced":
        const replacedA = `${a.replaced_first_name} ${a.replaced_last_name}`
        const replacedB = `${b.replaced_first_name} ${b.replaced_last_name}`
        comparison = replacedA.localeCompare(replacedB)
        break
      case "assigned":
        const assignedA = `${a.assigned_first_name} ${a.assigned_last_name}`
        const assignedB = `${b.assigned_first_name} ${b.assigned_last_name}`
        comparison = assignedA.localeCompare(assignedB)
        break
      default:
        comparison = 0
    }

    return sortDirection === "asc" ? comparison : -comparison
  })

  const handleDeleteClick = (assignment: any) => {
    setAssignmentToDelete(assignment)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!assignmentToDelete) return

    setIsDeleting(true)
    try {
      const result = await removeDirectAssignment(assignmentToDelete.shift_id, assignmentToDelete.user_id)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Assignation directe supprimée")
        router.refresh()
      }
    } catch (error) {
      toast.error("Erreur lors de la suppression")
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setAssignmentToDelete(null)
    }
  }

  return (
    <>
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Trier par..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="created_at">Date de création</SelectItem>
                <SelectItem value="replaced">Pompier remplacé</SelectItem>
                <SelectItem value="assigned">Remplaçant</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
            >
              {sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="show-past" checked={showPastAssignments} onCheckedChange={setShowPastAssignments} />
            <label
              htmlFor="show-past"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Afficher les remplacements passés
            </label>
          </div>
        </div>

        {sortedAssignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Aucune assignation directe</p>
            </CardContent>
          </Card>
        ) : (
          sortedAssignments.map((assignment: any) => {
            return (
              <Card key={assignment.id} className="overflow-hidden">
                <CardContent className="py-0 px-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    {/* Date and shift type */}
                    <div className="flex items-center gap-1.5 min-w-[140px]">
                      <span className="font-medium leading-none">{formatShortDate(assignment.shift_date)}</span>
                      <Badge
                        className={`${getShiftTypeColor(assignment.shift_type)} text-sm px-1.5 py-0 h-5 leading-none`}
                      >
                        {getShiftTypeLabel(assignment.shift_type).split(" ")[0]}
                      </Badge>
                      <PartTimeTeamBadge shiftDate={assignment.shift_date} />
                    </div>

                    {/* Replaced firefighter name */}
                    <div className="flex-1 min-w-0 leading-none">
                      <span className="truncate">
                        {assignment.replaced_first_name} {assignment.replaced_last_name}
                      </span>
                      {assignment.is_partial && (
                        <span className="text-orange-600 dark:text-orange-400 ml-1 text-xs">
                          ({assignment.start_time?.slice(0, 5)}-{assignment.end_time?.slice(0, 5)})
                        </span>
                      )}
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                        Créé {assignment.assigned_at ? formatCreatedAt(assignment.assigned_at) : "Date inconnue"}
                      </div>
                    </div>

                    {/* Assigned replacement firefighter name */}
                    <div className="text-xs text-blue-600 dark:text-blue-400 shrink-0 leading-none font-medium">
                      → {assignment.assigned_first_name} {assignment.assigned_last_name}
                    </div>

                    {/* Status badge - Direct assignment */}
                    <div className="shrink-0">
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-sm px-1.5 py-0 h-5 leading-none gap-1">
                        <Zap className="h-3 w-3" />
                        Direct
                      </Badge>
                    </div>

                    {/* Delete button (admin only) */}
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(assignment)}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'assignation directe</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette assignation directe ?
              {assignmentToDelete && (
                <div className="mt-2 text-foreground">
                  <strong>
                    {assignmentToDelete.assigned_first_name} {assignmentToDelete.assigned_last_name}
                  </strong>{" "}
                  remplace{" "}
                  <strong>
                    {assignmentToDelete.replaced_first_name} {assignmentToDelete.replaced_last_name}
                  </strong>{" "}
                  le <strong>{formatShortDate(assignmentToDelete.shift_date)}</strong>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
