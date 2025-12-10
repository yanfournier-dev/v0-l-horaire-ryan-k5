import { getSession } from "@/app/actions/auth"
import { getPendingExchangesCount } from "@/app/actions/exchanges"
import { Badge } from "@/components/ui/badge"

export async function ExchangesBadge() {
  const user = await getSession()
  if (!user || !user.is_admin) return null

  const count = await getPendingExchangesCount()

  if (count === 0) return null

  return <Badge className="ml-2 bg-red-600 text-white hover:bg-red-700">{count > 99 ? "99+" : count}</Badge>
}
