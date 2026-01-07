"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { revalidatePath } from "next/cache"
import { sendEmail, getApplicationApprovedEmail } from "@/lib/email"

export async function sendAssignmentNotification(replacementId: number) {
  const user = await getSession()
  if (!user || !user.is_admin) {
    return { error: "Non autorisé" }
  }

  try {
    const replacement = await sql`
      SELECT 
        r.*,
        u.id as assigned_user_id,
        u.first_name,
        u.last_name,
        u.email,
        replaced.first_name || ' ' || replaced.last_name as replaced_name
      FROM replacements r
      LEFT JOIN replacement_applications ra ON r.id = ra.replacement_id AND ra.status = 'approved'
      LEFT JOIN users u ON ra.applicant_id = u.id
      LEFT JOIN users replaced ON r.replaced_user_id = replaced.id
      WHERE r.id = ${replacementId}
    `

    if (replacement.length === 0) {
      return { error: "Remplacement non trouvé" }
    }

    const r = replacement[0]

    if (r.notification_sent === true) {
      return { error: "La notification a déjà été envoyée" }
    }

    if (!r.assigned_user_id) {
      return { error: "Aucun pompier assigné à ce remplacement" }
    }

    const userPrefs = await sql`
      SELECT 
        enable_email,
        enable_sms,
        enable_app,
        notify_replacement_accepted
      FROM notification_preferences
      WHERE user_id = ${r.assigned_user_id}
    `

    if (userPrefs.length === 0 || userPrefs[0].notify_replacement_accepted === false) {
      return { error: "Le pompier a désactivé les notifications de remplacement" }
    }

    const prefs = userPrefs[0]
    const typesSent: string[] = []
    const fullName = `${r.first_name} ${r.last_name}`

    if (prefs.enable_app !== false) {
      const partialHours =
        r.is_partial && r.start_time && r.end_time
          ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
          : null

      const message = partialHours
        ? `Vous avez été assigné pour remplacer ${r.replaced_name} le ${new Date(r.shift_date).toLocaleDateString("fr-CA")} de ${partialHours}`
        : `Vous avez été assigné pour remplacer ${r.replaced_name} le ${new Date(r.shift_date).toLocaleDateString("fr-CA")} (${r.shift_type})`

      await sql`
        INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
        VALUES (
          ${r.assigned_user_id}, 
          ${"Remplacement assigné"}, 
          ${message}, 
          ${"application_approved"}, 
          ${replacementId}, 
          ${"replacement"}
        )
      `
      typesSent.push("app")
    }

    if (prefs.enable_email === true && r.email) {
      if (process.env.VERCEL_ENV === "production") {
        const partialHours =
          r.is_partial && r.start_time && r.end_time
            ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
            : null

        const emailContent = getApplicationApprovedEmail(
          fullName,
          {
            date: r.shift_date,
            type: r.shift_type,
            firefighterToReplace: r.replaced_name,
          },
          partialHours,
        )

        try {
          await sendEmail(r.email, emailContent.subject, emailContent.html, emailContent.text)
          typesSent.push("email")
        } catch (emailError) {
          console.error("[v0] Email sending failed:", emailError)
          await notifyAdminsOfEmailFailure(r.email, "application_approved", emailError)
        }
      } else {
        console.log("[v0] Email skipped (non-production environment)")
      }
    }

    if (prefs.enable_sms === true && r.phone) {
      // TODO: Implémenter l'envoi de SMS via Twilio
      // typesSent.push("sms")
      console.log("[v0] SMS notifications not yet implemented")
    }

    await sql`
      UPDATE replacements
      SET 
        notification_sent = true,
        notification_sent_at = NOW(),
        notification_sent_by = ${user.id},
        notification_types_sent = ${JSON.stringify(typesSent)}::jsonb
      WHERE id = ${replacementId}
    `

    revalidatePath("/dashboard/replacements")

    return {
      success: true,
      typesSent,
      message: `Notification envoyée via: ${typesSent.join(", ")}`,
    }
  } catch (error) {
    console.error("[v0] Send assignment notification error:", error)
    return { error: "Erreur lors de l'envoi de la notification" }
  }
}

async function notifyAdminsOfEmailFailure(recipientEmail: string, notificationType: string, error: any) {
  try {
    const admins = await sql`
      SELECT id FROM users WHERE is_admin = true
    `

    const errorMessage = error instanceof Error ? error.message : String(error)

    for (const admin of admins) {
      await sql`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (
          ${admin.id}, 
          ${"Échec d'envoi d'email"}, 
          ${"L'email de notification de remplacement assigné à " + recipientEmail + " a échoué: " + errorMessage},
          ${"system"}
        )
      `
    }
  } catch (notifyError) {
    console.error("[v0] Failed to notify admins of email failure:", notifyError)
  }
}
