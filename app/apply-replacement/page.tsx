import { Suspense } from "react"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { revalidatePath } from "next/cache"

async function ApplyWithToken({ token }: { token: string }) {
  try {
    console.log("[v0] ApplyWithToken called with token:", token)

    // Verify token exists and is valid
    const tokenData = await sql`
      SELECT 
        at.id,
        at.replacement_id,
        at.user_id,
        at.used,
        at.expires_at,
        r.shift_date,
        r.shift_type,
        r.status as replacement_status,
        u.first_name,
        u.last_name
      FROM application_tokens at
      JOIN replacements r ON at.replacement_id = r.id
      JOIN users u ON at.user_id = u.id
      WHERE at.token = ${token}
    `

    console.log("[v0] Token data found:", tokenData.length > 0)

    if (tokenData.length === 0) {
      return (
        <Card className="max-w-md mx-auto mt-20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Lien invalide</CardTitle>
            </div>
            <CardDescription>Ce lien de candidature n'est pas valide.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/replacements">
              <Button className="w-full">Voir les remplacements disponibles</Button>
            </Link>
          </CardContent>
        </Card>
      )
    }

    const {
      replacement_id,
      user_id,
      used,
      expires_at,
      shift_date,
      shift_type,
      replacement_status,
      first_name,
      last_name,
    } = tokenData[0]

    console.log("[v0] Token details:", { replacement_id, user_id, used, expires_at, replacement_status })

    // Check if token is expired
    if (new Date(expires_at) < new Date()) {
      return (
        <Card className="max-w-md mx-auto mt-20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Lien expiré</CardTitle>
            </div>
            <CardDescription>Ce lien de candidature a expiré.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/replacements">
              <Button className="w-full">Voir les remplacements disponibles</Button>
            </Link>
          </CardContent>
        </Card>
      )
    }

    // Check if token was already used
    if (used) {
      return (
        <Card className="max-w-md mx-auto mt-20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle>Candidature déjà soumise</CardTitle>
            </div>
            <CardDescription>Vous avez déjà postulé pour ce remplacement.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/replacements">
              <Button className="w-full">Voir mes candidatures</Button>
            </Link>
          </CardContent>
        </Card>
      )
    }

    // Check if replacement is still open
    if (replacement_status !== "open") {
      return (
        <Card className="max-w-md mx-auto mt-20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Remplacement non disponible</CardTitle>
            </div>
            <CardDescription>Ce remplacement n'est plus disponible.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/replacements">
              <Button className="w-full">Voir les remplacements disponibles</Button>
            </Link>
          </CardContent>
        </Card>
      )
    }

    const existingApplication = await sql`
      SELECT id FROM replacement_applications
      WHERE replacement_id = ${replacement_id} AND applicant_id = ${user_id}
    `

    if (existingApplication.length > 0) {
      console.log("[v0] User already applied for this replacement")

      // Mark token as used anyway
      await sql`
        UPDATE application_tokens
        SET used = true
        WHERE token = ${token}
      `

      return (
        <Card className="max-w-md mx-auto mt-20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle>Candidature déjà soumise</CardTitle>
            </div>
            <CardDescription>Vous avez déjà postulé pour ce remplacement.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/replacements">
              <Button className="w-full">Voir mes candidatures</Button>
            </Link>
          </CardContent>
        </Card>
      )
    }

    console.log("[v0] Inserting application for user:", user_id, "replacement:", replacement_id)

    await sql`
      INSERT INTO replacement_applications (replacement_id, applicant_id, status)
      VALUES (${replacement_id}, ${user_id}, 'pending')
    `

    console.log("[v0] Application inserted successfully")

    // Mark token as used
    await sql`
      UPDATE application_tokens
      SET used = true
      WHERE token = ${token}
    `

    console.log("[v0] Token marked as used")

    // Revalidate paths
    revalidatePath("/dashboard/replacements")
    revalidatePath("/dashboard/calendar")
    revalidatePath("/dashboard")

    const formattedDate = new Date(shift_date).toLocaleDateString("fr-CA")
    const shiftTypeText = shift_type === "day" ? "Jour" : shift_type === "night" ? "Nuit" : "24h"

    return (
      <Card className="max-w-md mx-auto mt-20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <CardTitle>Candidature soumise!</CardTitle>
          </div>
          <CardDescription>
            Votre candidature pour le remplacement du {formattedDate} ({shiftTypeText}) a été soumise avec succès.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Vous recevrez une notification lorsqu'un administrateur examinera votre candidature.
          </p>
          <Link href="/dashboard/replacements">
            <Button className="w-full">Voir mes candidatures</Button>
          </Link>
        </CardContent>
      </Card>
    )
  } catch (error) {
    console.error("[v0] Error applying with token:", error)
    return (
      <Card className="max-w-md mx-auto mt-20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <XCircle className="h-6 w-6 text-destructive" />
            <CardTitle>Erreur</CardTitle>
          </div>
          <CardDescription>Une erreur s'est produite lors du traitement de votre candidature.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/replacements">
            <Button className="w-full">Voir les remplacements disponibles</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }
}

export default async function ApplyReplacementPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = params.token

  if (!token) {
    redirect("/dashboard/replacements")
  }

  return (
    <div className="container py-10">
      <Suspense
        fallback={
          <Card className="max-w-md mx-auto mt-20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <CardTitle>Traitement en cours...</CardTitle>
              </div>
              <CardDescription>Veuillez patienter pendant que nous traitons votre candidature.</CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <ApplyWithToken token={token} />
      </Suspense>
    </div>
  )
}
