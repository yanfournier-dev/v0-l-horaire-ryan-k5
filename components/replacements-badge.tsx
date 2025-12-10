import { getSession } from "@/app/actions/auth"
import { getReplacementsAdminActionCount } from "@/app/actions/replacements"
import { Badge } from "@/components/ui/badge"

export async function ReplacementsBadge() {
  const user = await getSession()
  if (!user || !user.is_admin) return null

  const count = await getReplacementsAdminActionCount()

  if (count === 0) return null

  return <Badge className="ml-2 bg-red-600 text-white hover:bg-red-700">{count > 99 ? "99+" : count}</Badge>
}
