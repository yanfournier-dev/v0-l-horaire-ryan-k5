import { getAuditLogs } from "@/app/actions/audit"
import { AuditLogsTable } from "@/components/audit-logs-table"

export const dynamic = "force-dynamic"

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { page?: string; userId?: string; actionType?: string }
}) {
  const page = Number.parseInt(searchParams.page || "1")
  const userId = searchParams.userId ? Number.parseInt(searchParams.userId) : undefined
  const actionType = searchParams.actionType as any

  const { logs, pagination } = await getAuditLogs({
    page,
    userId,
    actionType,
  })

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Journal d'activités</h1>
        <p className="text-muted-foreground mt-2">
          Consultez l'historique complet de toutes les actions effectuées dans l'application. Les logs sont conservés
          pendant 1 an.
        </p>
      </div>

      <AuditLogsTable logs={logs} pagination={pagination} />
    </div>
  )
}
