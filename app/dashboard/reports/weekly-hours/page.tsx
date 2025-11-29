import { Suspense } from "react"
import { WeeklyHoursReport } from "@/components/weekly-hours-report"

export const metadata = {
  title: "Rapport des heures hebdomadaires",
  description: "Consultez les heures de travail de tous les pompiers par semaine",
}

export default function WeeklyHoursPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rapport des heures hebdomadaires</h1>
        <p className="text-muted-foreground mt-2">
          Consultez les heures de travail de tous les pompiers pour une semaine donnée
        </p>
      </div>

      <Suspense fallback={<div>Chargement...</div>}>
        <WeeklyHoursReport />
      </Suspense>
    </div>
  )
}
