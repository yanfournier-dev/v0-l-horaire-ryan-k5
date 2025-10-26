"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check, X, ArrowUpDown } from "lucide-react"
import { parseLocalDate } from "@/lib/date-utils"
import { getShiftTypeColor, getShiftTypeLabel } from "@/lib/colors"
import { approveReplacementRequest, rejectReplacementRequest } from "@/app/actions/replacements"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { compareShifts } from "@/lib/shift-sort"
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
import { DeadlineSelect } from "@/components/deadline-select"

interface PendingRequestsTabProps {
  pendingRequests: any[]
}

export function PendingRequestsTab({ pendingRequests }: PendingRequestsTabProps) {
  const router = useRouter()
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<"date" | "name">("date")
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [deadlineMinutes, setDeadlineMinutes] = useState<number | null>(null)

  const handleApprove = async (replacementId: number) => {
    setSelectedRequestId(replacementId)
    setApprovalDialogOpen(true)
  }

  const handleConfirmApproval = async () => {
    if (!selectedRequestId) return

    setProcessingId(selectedRequestId)
    const result = await approveReplacementRequest(selectedRequestId, deadlineMinutes ?? undefined)
    if (result.error) {
      alert(result.error)
    }
    setProcessingId(null)
    setApprovalDialogOpen(false)
    setSelectedRequestId(null)
    setDeadlineMinutes(null)
    router.refresh()
  }

  const handleCancelApproval = () => {
    setApprovalDialogOpen(false)
    setSelectedRequestId(null)
    setDeadlineMinutes(null)
  }

  const handleReject = async (replacementId: number) => {
    setProcessingId(replacementId)
    const result = await rejectReplacementRequest(replacementId)
    if (result.error) {
      alert(result.error)
    }
    setProcessingId(null)
    router.refresh()
  }

  if (pendingRequests.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucune demande de remplacement en attente</p>
        </CardContent>
      </Card>
    )
  }

  const sortedRequests = [...pendingRequests].sort((a, b) => {
    switch (sortBy) {
      case "date":
        return compareShifts(a, b, parseLocalDate)
      case "name":
        const nameA = `${a.first_name} ${a.last_name}`
        const nameB = `${b.first_name} ${b.last_name}`
        return nameA.localeCompare(nameB)
      default:
        return 0
    }
  })

  return (
    <>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Trier par..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="name">Nom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {sortedRequests.map((request: any) => (
          <Card key={request.id} className="overflow-hidden">
            <CardContent className="py-0 px-1.5">
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1.5 min-w-[140px]">
                  <span className="font-medium leading-none">
                    {parseLocalDate(request.shift_date).toLocaleDateString("fr-CA", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <Badge className={`${getShiftTypeColor(request.shift_type)} text-sm px-1.5 py-0 h-5 leading-none`}>
                    {getShiftTypeLabel(request.shift_type).split(" ")[0]}
                  </Badge>
                  {request.is_partial && (
                    <Badge variant="outline" className="text-sm px-1.5 py-0 h-5 leading-none">
                      {request.start_time?.slice(0, 5)}-{request.end_time?.slice(0, 5)}
                    </Badge>
                  )}
                </div>

                <div className="flex-1 min-w-0 leading-none truncate">
                  {request.first_name} {request.last_name} • {request.team_name}
                </div>

                <div className="flex gap-0.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReject(request.id)}
                    disabled={processingId === request.id}
                    className="h-6 text-xs px-2 gap-1 leading-none"
                  >
                    <X className="h-3 w-3" />
                    Rejeter
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(request.id)}
                    disabled={processingId === request.id}
                    className="h-6 text-xs px-2 gap-1 leading-none"
                  >
                    <Check className="h-3 w-3" />
                    Approuver
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approuver la demande de remplacement</AlertDialogTitle>
            <AlertDialogDescription>
              Choisissez un délai optionnel pour les candidatures. Après ce délai, la demande sera fermée et prête à
              être assignée.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <DeadlineSelect value={deadlineMinutes} onValueChange={setDeadlineMinutes} />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelApproval}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmApproval} disabled={processingId === selectedRequestId}>
              {processingId === selectedRequestId ? "Approbation..." : "Approuver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
