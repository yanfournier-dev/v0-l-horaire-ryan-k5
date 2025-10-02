import { importTeam1Firefighters } from "@/app/actions/users"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export default function ImportTeam1Page() {
  async function handleImport() {
    "use server"
    const result = await importTeam1Firefighters()
    revalidatePath("/dashboard/admin/import-team1")
    if (result.success) {
      redirect("/dashboard/firefighters")
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Importer l'Équipe Permanente 1</CardTitle>
          <CardDescription>
            Cliquez sur le bouton ci-dessous pour importer automatiquement les 8 pompiers de l'Équipe Permanente 1
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <h3 className="mb-2 font-semibold">Pompiers à importer:</h3>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>Yan Fournier</li>
              <li>Michel Ruel</li>
              <li>Marc-André Dubois</li>
              <li>Patrick Bourassa</li>
              <li>Simon Poisson-Carignan</li>
              <li>Francis Allard</li>
              <li>Raphael Cloutier</li>
              <li>Alexandre Pouliot</li>
            </ul>
          </div>

          <div className="rounded-lg border border-yellow-500 bg-yellow-50 p-4 text-sm">
            <p className="font-semibold text-yellow-800">Informations importantes:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-yellow-700">
              <li>
                Mot de passe par défaut: <strong>Pompier2025!</strong>
              </li>
              <li>Les emails seront générés automatiquement (format: prenom.nom@victoriaville.ca)</li>
              <li>Les pompiers déjà existants seront ignorés</li>
            </ul>
          </div>

          <form action={handleImport}>
            <Button type="submit" size="lg" className="w-full">
              Importer l'Équipe Permanente 1
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
