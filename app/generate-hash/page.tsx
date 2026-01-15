import { hashPassword } from "@/app/actions/auth"

export default async function GenerateHashPage() {
  // Générer le hash pour SSIV2026
  const hash = await hashPassword("SSIV2026")

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-2xl w-full space-y-6 bg-card p-8 rounded-lg border">
        <h1 className="text-2xl font-bold text-foreground">Hash généré pour SSIV2026</h1>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Copiez ce hash et exécutez la commande SQL ci-dessous dans Neon:
          </p>

          <div className="bg-muted p-4 rounded-md">
            <p className="text-xs font-mono break-all">{hash}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Commande SQL à exécuter:</p>
          <div className="bg-muted p-4 rounded-md">
            <code className="text-xs font-mono block whitespace-pre-wrap break-all">
              {`UPDATE users SET password_hash = '${hash}';`}
            </code>
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-md">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Après avoir exécuté cette commande SQL, tous les utilisateurs pourront se connecter avec le mot de passe:{" "}
            <strong>SSIV2026</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
