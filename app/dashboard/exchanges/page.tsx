import { getSession } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import {
  getUserExchanges,
  getPendingExchanges,
  getAllExchanges,
  getUserExchangeCount,
  checkExchangeTablesExist,
} from "@/app/actions/exchanges"
import { getAllFirefighters } from "@/app/actions/teams"
import { ExchangesTabs } from "@/components/exchanges-tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { parseLocalDate } from "@/lib/date-utils"

export const dynamic = "force-dynamic"

export default async function ExchangesPage() {
  const user = await getSession()

  if (!user) {
    redirect("/login")
  }

  const tablesCheck = await checkExchangeTablesExist()

  if (!tablesCheck.exists) {
    return (
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Échanges de quarts</h1>
          <p className="text-muted-foreground">Gérer vos demandes d'échange de quarts avec d'autres pompiers</p>
        </div>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-orange-900">Configuration requise</CardTitle>
            </div>
            <CardDescription className="text-orange-700">
              Le système d'échanges de quarts n'est pas encore configuré dans votre base de données.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-orange-800">
              Pour utiliser cette fonctionnalité, vous devez d'abord exécuter le script SQL qui créera les tables
              nécessaires.
            </p>
            <div className="flex gap-3">
              {user.is_admin ? (
                <>
                  <Button asChild>
                    <Link href="/dashboard/admin/run-scripts">Exécuter le script maintenant</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/settings">Aller aux paramètres</Link>
                  </Button>
                </>
              ) : (
                <p className="text-sm text-orange-800">
                  Veuillez contacter un administrateur pour configurer cette fonctionnalité.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const [userExchangesResult, pendingExchangesResult, allExchangesResult, exchangeCountResult, allFirefighters] =
    await Promise.all([
      getUserExchanges(user.id),
      user.is_admin ? getPendingExchanges() : Promise.resolve({ exchanges: [] }),
      user.is_admin ? getAllExchanges() : Promise.resolve({ exchanges: [] }),
      getUserExchangeCount(user.id),
      user.is_admin ? getAllFirefighters() : Promise.resolve([]),
    ])

  const userExchanges = userExchangesResult.exchanges || []
  const pendingExchanges = pendingExchangesResult.exchanges || []
  const allExchanges = allExchangesResult.exchanges || []
  const exchangeCount = exchangeCountResult.count || 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const nonPastExchangesCount = allExchanges.filter((exchange: any) => {
    const requesterDate = parseLocalDate(exchange.requester_shift_date)
    const targetDate = parseLocalDate(exchange.target_shift_date)
    return requesterDate >= today || targetDate >= today
  }).length

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Échanges de quarts</h1>
        <p className="text-muted-foreground">Gérer vos demandes d'échange de quarts avec d'autres pompiers</p>
        <div className="mt-2 text-sm text-muted-foreground">
          Échanges utilisés cette année: <span className="font-semibold">{exchangeCount} / 8</span>
        </div>
      </div>

      <ExchangesTabs
        userExchanges={userExchanges}
        pendingExchanges={pendingExchanges}
        allExchanges={allExchanges}
        nonPastExchangesCount={nonPastExchangesCount}
        isAdmin={user.is_admin}
        userId={user.id}
        exchangeCount={exchangeCount}
        allFirefighters={allFirefighters}
      />
    </div>
  )
}
