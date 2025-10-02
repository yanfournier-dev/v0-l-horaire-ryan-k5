import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { createTeam } from "@/app/actions/teams"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

async function addPompiersReguliers() {
  "use server"

  const result = await createTeam({
    name: "Pompiers Réguliers",
    type: "permanent",
    capacity: null, // unlimited
    color: "#f59e0b", // amber
  })

  if (result.success) {
    redirect("/dashboard/teams")
  }

  return result
}

export default async function AddPompiersReguliersPage() {
  const user = await getSession()

  if (!user || !user.is_admin) {
    redirect("/dashboard")
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Ajouter l'équipe Pompiers Réguliers</CardTitle>
          <CardDescription>
            Cette page permet d'ajouter l'équipe "Pompiers Réguliers" avec une capacité illimitée.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addPompiersReguliers}>
            <Button type="submit" size="lg">
              Ajouter l'équipe Pompiers Réguliers
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
