"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, AlertCircle, Upload } from "lucide-react"
import { bulkImportFirefighters } from "@/app/actions/users"

interface Team {
  id: number
  name: string
  type: string
  color: string
}

interface ImportFirefightersFormProps {
  teams: Team[]
}

export function ImportFirefightersForm({ teams }: ImportFirefightersFormProps) {
  const [firefightersData, setFirefightersData] = useState("")
  const [selectedTeamId, setSelectedTeamId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; count?: number } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResult(null)

    try {
      const response = await bulkImportFirefighters(
        firefightersData,
        selectedTeamId ? Number.parseInt(selectedTeamId) : null,
      )

      setResult(response)

      if (response.success) {
        setFirefightersData("")
        setSelectedTeamId("")
      }
    } catch (error) {
      setResult({
        success: false,
        message: "Une erreur est survenue lors de l'importation",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Format des données</CardTitle>
          <CardDescription>Collez les informations des pompiers, un par ligne, au format suivant :</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            <div>Prénom Nom, email@example.com, 514-555-0123</div>
            <div className="text-muted-foreground mt-2">ou simplement :</div>
            <div>Prénom Nom</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="firefighters">Liste des pompiers</Label>
            <Textarea
              id="firefighters"
              placeholder="Jean Tremblay, jean.tremblay@example.com, 514-555-0123&#10;Marie Dubois, marie.dubois@example.com, 514-555-0124&#10;Pierre Gagnon"
              value={firefightersData}
              onChange={(e) => setFirefightersData(e.target.value)}
              rows={10}
              className="font-mono text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team">Équipe (optionnel)</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger id="team">
                <SelectValue placeholder="Sélectionner une équipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune équipe</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                      {team.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Si sélectionnée, tous les pompiers seront ajoutés à cette équipe
            </p>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Alert variant={result.success ? "default" : "destructive"}>
          {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>
            {result.message}
            {result.count &&
              ` (${result.count} pompier${result.count > 1 ? "s" : ""} ajouté${result.count > 1 ? "s" : ""})`}
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isLoading || !firefightersData.trim()} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Importation en cours...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Importer les pompiers
          </>
        )}
      </Button>
    </form>
  )
}
