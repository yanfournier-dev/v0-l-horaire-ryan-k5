"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmailTemplateEditor } from "@/components/email-template-editor"
import type { EmailTemplate } from "@/app/actions/email-templates"
import { Mail } from "lucide-react"

interface EmailTemplatesListProps {
  templates: EmailTemplate[]
}

export function EmailTemplatesList({ templates }: EmailTemplatesListProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)

  return (
    <div className="space-y-6">
      {selectedTemplate ? (
        <EmailTemplateEditor template={selectedTemplate} onBack={() => setSelectedTemplate(null)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="text-sm mt-1">{template.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Sujet</p>
                    <p className="text-sm mt-1">{template.subject}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Variables disponibles</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {template.variables.map((variable) => (
                        <code key={variable} className="text-xs bg-muted px-2 py-1 rounded">
                          {`{{${variable}}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                  <Button onClick={() => setSelectedTemplate(template)} className="w-full mt-2">
                    Modifier le template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
