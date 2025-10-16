import { getAvailableScripts } from "@/app/actions/run-scripts"
import { ScriptRunner } from "@/components/script-runner"

export const dynamic = "force-dynamic"

export default async function RunScriptsPage() {
  const scripts = await getAvailableScripts()

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Exécuter les scripts SQL</h1>
        <p className="text-muted-foreground mt-2">
          Exécutez les scripts SQL directement depuis cette page. Plus besoin de copier-coller dans Neon!
        </p>
      </div>

      <ScriptRunner scripts={scripts} />
    </div>
  )
}
