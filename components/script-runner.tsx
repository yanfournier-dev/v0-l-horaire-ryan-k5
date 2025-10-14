"use client"

import { useState } from "react"
import { executeScript } from "@/app/actions/run-scripts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, XCircle, Loader2, Play } from "lucide-react"

interface ScriptRunnerProps {
  scripts: string[]
}

export function ScriptRunner({ scripts }: ScriptRunnerProps) {
  const [executing, setExecuting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { success: boolean; message: string; error?: string }>>({})

  const handleExecute = async (scriptName: string) => {
    setExecuting(scriptName)
    setResults((prev) => ({ ...prev, [scriptName]: undefined as any }))

    try {
      const result = await executeScript(scriptName)
      setResults((prev) => ({ ...prev, [scriptName]: result }))
    } catch (error: any) {
      setResults((prev) => ({
        ...prev,
        [scriptName]: {
          success: false,
          message: error.message || "Erreur inconnue",
        },
      }))
    } finally {
      setExecuting(null)
    }
  }

  if (scripts.length === 0) {
    return (
      <Alert>
        <AlertDescription>Aucun script SQL trouvé dans le dossier scripts/</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {scripts.map((script) => {
        const result = results[script]
        const isExecuting = executing === script

        return (
          <Card key={script}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="font-mono text-base">{script}</span>
                <Button onClick={() => handleExecute(script)} disabled={isExecuting} size="sm">
                  {isExecuting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exécution...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Exécuter
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            {result && (
              <CardContent>
                <Alert
                  variant={result.success ? "default" : "destructive"}
                  className={result.success ? "border-green-500 bg-green-50" : "border-red-500"}
                >
                  <div className="flex items-start gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div className="flex-1">
                      <AlertDescription className="font-medium">{result.message}</AlertDescription>
                      {result.error && (
                        <pre className="mt-2 text-xs bg-black/5 p-2 rounded overflow-x-auto">{result.error}</pre>
                      )}
                    </div>
                  </div>
                </Alert>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
