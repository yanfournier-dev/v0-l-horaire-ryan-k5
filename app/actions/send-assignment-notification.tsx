"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { revalidatePath } from "next/cache"
import { sendEmail, getApplicationApprovedEmail, getApplicationRejectedEmail } from "@/lib/email"
import { createNotification } from "@/app/actions/notifications"

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
      LEFT JOIN users replaced ON r.user_id = replaced.id
      WHERE r.id = ${replacementId}
    `

    if (replacement.length === 0) {
      return { error: "Remplacement non trouvé" }
    }

    const r = replacement[0]

    if (!r.assigned_user_id) {
      return { error: "Aucun pompier assigné à ce remplacement" }
    }

    const userPrefs = await sql`
      SELECT 
        enable_email,
        enable_telegram,
        telegram_chat_id,
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
    const typesFailed: string[] = []
    const fullName = `${r.first_name} ${r.last_name}`

    const partialHours =
      r.is_partial && r.start_time && r.end_time
        ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
        : null

    const message = partialHours
      ? `Vous avez été assigné pour remplacer ${r.replaced_name} le ${new Date(r.shift_date).toLocaleDateString("fr-CA")} de ${partialHours}`
      : `Vous avez été assigné pour remplacer ${r.replaced_name} le ${new Date(r.shift_date).toLocaleDateString("fr-CA")} (${r.shift_type})`

    const notificationResult = await createNotification(
      r.assigned_user_id,
      "Remplacement assigné",
      message,
      "replacement_accepted",
      replacementId,
      "replacement",
      user.id,
    )

    if (notificationResult.channelsSent) {
      typesSent.push(...notificationResult.channelsSent)
    }
    if (notificationResult.channelsFailed) {
      typesFailed.push(...notificationResult.channelsFailed)
    }

    // Email notification for accepted candidate
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
          console.error("Email sending failed:", emailError)
          await notifyAdminsOfEmailFailure(r.email, "replacement_accepted", emailError)
          typesFailed.push("email")
        }
      }
    }

    const rejectedCandidates = await sql`
      SELECT 
        ra.applicant_id,
        u.first_name,
        u.last_name,
        u.email,
        np.enable_email,
        np.enable_telegram,
        np.telegram_chat_id,
        np.enable_app,
        np.notify_replacement_rejected
      FROM replacement_applications ra
      JOIN users u ON ra.applicant_id = u.id
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE ra.replacement_id = ${replacementId}
        AND ra.status = 'rejected'
        AND (np.notify_replacement_rejected IS NULL OR np.notify_replacement_rejected = true)
    `

    for (const rejected of rejectedCandidates) {
      const rejectedFullName = `${rejected.first_name} ${rejected.last_name}`

      const partialHoursRejected =
        r.is_partial && r.start_time && r.end_time
          ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
          : null

      const messageRejected = partialHoursRejected
        ? `Votre candidature pour remplacer ${r.replaced_name} le ${new Date(r.shift_date).toLocaleDateString("fr-CA")} de ${partialHoursRejected} a été rejetée.`
        : `Votre candidature pour remplacer ${r.replaced_name} le ${new Date(r.shift_date).toLocaleDateString("fr-CA")} (${r.shift_type}) a été rejetée.`

      const rejectedNotificationResult = await createNotification(
        rejected.applicant_id,
        "Candidature rejetée",
        messageRejected,
        "replacement_rejected",
        replacementId,
        "replacement",
        user.id,
      )

      if (rejectedNotificationResult.channelsSent) {
        typesSent.push(...rejectedNotificationResult.channelsSent)
      }
      if (rejectedNotificationResult.channelsFailed) {
        typesFailed.push(...rejectedNotificationResult.channelsFailed)
      }

      // Email notification for rejected candidate
      if (rejected.enable_email === true && rejected.email) {
        if (process.env.VERCEL_ENV === "production") {
          const partialHours =
            r.is_partial && r.start_time && r.end_time
              ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
              : null

          const emailContent = getApplicationRejectedEmail(
            rejectedFullName,
            {
              date: r.shift_date,
              type: r.shift_type,
              firefighterToReplace: r.replaced_name,
            },
            partialHours,
          )

          try {
            await sendEmail(rejected.email, emailContent.subject, emailContent.html, emailContent.text)
            typesSent.push("email")
          } catch (emailError) {
            console.error("Email sending failed for rejected candidate:", emailError)
            typesFailed.push("email")
          }
        }
      }
    }

    await sql`
      UPDATE replacements
      SET 
        notification_sent = true,
        notification_sent_at = NOW(),
        notification_sent_by = ${user.id},
        notification_types_sent = ${JSON.stringify(typesSent)}::jsonb,
        notification_channels_failed = ${JSON.stringify(typesFailed)}::jsonb
      WHERE id = ${replacementId}
    `

    revalidatePath("/dashboard/replacements")

    return {
      success: true,
      typesSent,
      typesFailed,
      message: `Notifications envoyées (${typesSent.join(", ")})${typesFailed.length > 0 ? ` - Échecs: ${typesFailed.join(", ")}` : ""}`,
    }
  } catch (error) {
    console.error("Send assignment notification error:", error)
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
    console.error("Failed to notify admins of email failure:", notifyError)
  }
}
