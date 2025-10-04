"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save } from "lucide-react"
import { updateEmailTemplate } from "@/app/actions/email-templates"
import { useToast } from "@/hooks/use-toast"
import type { EmailTemplate } from "@/app/actions/email-templates"

interface EmailTemplateEditorProps {
  template: EmailTemplate
  onBack: () => void
}

export function EmailTemplateEditor({ template, onBack }: EmailTemplateEditorProps) {
  const [subject, setSubject] = useState(template.subject)
  const [body, setBody] = useState(template.body)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const result = await updateEmailTemplate(template.id, { subject, body })

      if (result.success) {
        toast({
          title: "Template mis à jour",
          description: "Le template d'email a été mis à jour avec succès",
        })
        onBack()
      } else {
        toast({
          title: "Erreur",
          description: result.error || "Impossible de mettre à jour le template",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Retour
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{template.name}</CardTitle>
          <CardDescription>{template.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="subject">Sujet de l'email</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sujet de l'email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Corps de l'email (HTML)</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Corps de l'email en HTML"
              rows={20}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Variables disponibles</Label>
            <div className="flex flex-wrap gap-2">
              {template.variables.map((variable) => (
                <code
                  key={variable}
                  className="text-sm bg-muted px-3 py-1 rounded cursor-pointer hover:bg-muted/80"
                  onClick={() => {
                    navigator.clipboard.writeText(`{{${variable}}}`)
                    toast({
                      title: "Copié",
                      description: `{{${variable}}} copié dans le presse-papier`,
                    })
                  }}
                >
                  {`{{${variable}}}`}
                </code>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Cliquez sur une variable pour la copier. Utilisez ces variables dans le sujet et le corps de l'email.
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={isLoading} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? "Enregistrement..." : "Enregistrer"}
            </Button>
            <Button variant="outline" onClick={onBack} disabled={isLoading}>
              Annuler
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
