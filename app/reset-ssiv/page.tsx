import { sql } from "@/lib/db"
import crypto from "crypto"

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex")
  return `${salt}:${hash}`
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { confirm?: string }
}) {
  const isConfirmed = searchParams.confirm === "yes"

  if (isConfirmed) {
    try {
      const newPasswordHash = hashPassword("SSIV2026")

      const result = await sql`
        UPDATE users 
        SET password = ${newPasswordHash}
        WHERE id IS NOT NULL
      `

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <div className="text-6xl">✅</div>
            <h1 className="text-2xl font-bold text-green-600">Réinitialisation réussie!</h1>
            <p className="text-muted-foreground">
              Tous les utilisateurs ont le mot de passe: <strong className="text-foreground">SSIV2026</strong>
            </p>
            <p className="text-sm text-muted-foreground">Vous pouvez maintenant vous connecter.</p>
            <a
              href="/login"
              className="inline-block mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Aller à la connexion
            </a>
            <p className="text-xs text-red-600 mt-8">
              IMPORTANT: Supprimez le dossier app/reset-ssiv après utilisation!
            </p>
          </div>
        </div>
      )
    } catch (error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <div className="text-6xl">❌</div>
            <h1 className="text-2xl font-bold text-red-600">Erreur</h1>
            <p className="text-muted-foreground">
              {error instanceof Error ? error.message : "Une erreur est survenue"}
            </p>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="text-6xl">⚠️</div>
        <h1 className="text-3xl font-bold">Réinitialiser tous les mots de passe</h1>
        <p className="text-muted-foreground">
          Cette action va changer le mot de passe de TOUS les utilisateurs à:{" "}
          <strong className="text-foreground">SSIV2026</strong>
        </p>
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ Cette action est irréversible et affectera tous les comptes!
          </p>
        </div>
        <a
          href="/reset-ssiv?confirm=yes"
          className="inline-block w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
        >
          Confirmer la réinitialisation
        </a>
        <p className="text-xs text-muted-foreground mt-4">Cliquez sur le bouton pour exécuter la réinitialisation</p>
      </div>
    </div>
  )
}
