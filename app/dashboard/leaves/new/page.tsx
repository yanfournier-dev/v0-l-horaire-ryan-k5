import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { createLeaveRequest } from "@/app/actions/leaves"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

export default async function NewLeavePage() {
  const user = await getSession()
  if (!user) redirect("/login")

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard/leaves">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Retour aux demandes
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Nouvelle demande d'absence</CardTitle>
            <CardDescription>Remplissez le formulaire pour demander une absence</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createLeaveRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Date de début</Label>
                  <Input id="startDate" name="startDate" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Date de fin</Label>
                  <Input id="endDate" name="endDate" type="date" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="leaveType">Type d'absence</Label>
                <Select name="leaveType" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Journée complète</SelectItem>
                    <SelectItem value="partial">Partielle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4" id="timeFields">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Heure de début (optionnel)</Label>
                  <Input id="startTime" name="startTime" type="time" />
                  <p className="text-xs text-muted-foreground">Pour les absences partielles (ex: 7h-12h)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">Heure de fin (optionnel)</Label>
                  <Input id="endTime" name="endTime" type="time" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Raison (optionnel)</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  placeholder="Expliquez brièvement la raison de votre absence..."
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Link href="/dashboard/leaves" className="flex-1">
                  <Button type="button" variant="outline" className="w-full bg-transparent">
                    Annuler
                  </Button>
                </Link>
                <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700">
                  Soumettre la demande
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
