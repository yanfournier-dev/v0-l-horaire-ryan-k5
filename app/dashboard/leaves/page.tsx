import { getSession } from "@/lib/auth"
import { getUserLeaves, getAllLeaves } from "@/app/actions/leaves"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ApproveLeaveButton } from "@/components/approve-leave-button"
import { RejectLeaveButton } from "@/components/reject-leave-button"
import { DeleteLeaveButton } from "@/components/delete-leave-button"
import { parseLocalDate, formatLocalDateTime } from "@/lib/date-utils"

export const dynamic = "force-dynamic"

export default async function LeavesPage() {
  const user = await getSession()
  if (!user) redirect("/login")

  const leaves = user.is_admin ? await getAllLeaves() : await getUserLeaves(user.id)

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "En attente"
      case "approved":
        return "Approuvée"
      case "rejected":
        return "Rejetée"
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case "full":
        return "Journée complète"
      case "partial":
        return "Partielle"
      default:
        return type
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Demandes d'absence</h1>
          <p className="text-muted-foreground">
            {user.is_admin ? "Gérez toutes les demandes d'absence" : "Vos demandes d'absence"}
          </p>
        </div>

        <Link href="/dashboard/leaves/new">
          <Button className="bg-red-600 hover:bg-red-700">+ Nouvelle demande</Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {leaves.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Aucune demande d'absence</p>
            </CardContent>
          </Card>
        ) : (
          leaves.map((leave: any) => (
            <Card key={leave.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {user.is_admin && `${leave.first_name} ${leave.last_name} - `}
                      {parseLocalDate(leave.start_date).toLocaleDateString("fr-CA")} au{" "}
                      {parseLocalDate(leave.end_date).toLocaleDateString("fr-CA")}
                    </CardTitle>
                    <CardDescription>
                      {getLeaveTypeLabel(leave.leave_type)}
                      {leave.reason && ` • ${leave.reason}`}
                      {" • Créée le "}
                      {formatLocalDateTime(leave.created_at)}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(leave.status)}>{getStatusLabel(leave.status)}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {leave.status === "pending" && <p>En attente d'approbation</p>}
                    {leave.status === "approved" && leave.approver_first_name && (
                      <p>
                        Approuvée par {leave.approver_first_name} {leave.approver_last_name} le{" "}
                        {parseLocalDate(leave.approved_at).toLocaleDateString("fr-CA")}
                      </p>
                    )}
                    {leave.status === "rejected" && leave.approver_first_name && (
                      <p>
                        Rejetée par {leave.approver_first_name} {leave.approver_last_name} le{" "}
                        {parseLocalDate(leave.approved_at).toLocaleDateString("fr-CA")}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {user.is_admin && leave.status === "pending" && (
                      <>
                        <ApproveLeaveButton leaveId={leave.id} />
                        <RejectLeaveButton leaveId={leave.id} />
                      </>
                    )}
                    {(leave.user_id === user.id || user.is_admin) && leave.status === "pending" && (
                      <DeleteLeaveButton leaveId={leave.id} />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
