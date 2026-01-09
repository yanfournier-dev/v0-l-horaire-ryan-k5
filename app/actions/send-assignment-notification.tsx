"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/app/actions/auth"
import { revalidatePath } from "next/cache"
import { sendEmail, getApplicationApprovedEmail, getApplicationRejectedEmail } from "@/lib/email"
import { sendTelegramMessage } from "@/lib/telegram"

export async function sendAssignmentNotification(replacementId: number) {
  console.log("[v0] sendAssignmentNotification called for replacementId:", replacementId)

  const user = await getSession()
  if (!user || !user.is_admin) {
    console.log("[v0] sendAssignmentNotification: User not authorized")
    return { error: "Non autorisé" }
  }

  console.log("[v0] sendAssignmentNotification: User authorized, userId:", user.id)

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

    console.log("[v0] sendAssignmentNotification: Replacement found:", {
      id: replacement[0]?.id,
      assigned_user_id: replacement[0]?.assigned_user_id,
      notification_sent: replacement[0]?.notification_sent,
    })

    if (replacement.length === 0) {
      return { error: "Remplacement non trouvé" }
    }

    const r = replacement[0]

    if (r.notification_sent === true) {
      console.log("[v0] sendAssignmentNotification: Notification already sent")
      return { error: "La notification a déjà été envoyée" }
    }

    if (!r.assigned_user_id) {
      console.log("[v0] sendAssignmentNotification: No assigned user")
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
    const fullName = `${r.first_name} ${r.last_name}`

    // In-app notification for accepted candidate
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
          ${"replacement_accepted"}, 
          ${replacementId}, 
          ${"replacement"}
        )
      `
      typesSent.push("app")
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
          console.error("[v0] Email sending failed:", emailError)
          await notifyAdminsOfEmailFailure(r.email, "replacement_accepted", emailError)
        }
      }
    }

    if (prefs.enable_telegram === true && prefs.telegram_chat_id) {
      const partialHours =
        r.is_partial && r.start_time && r.end_time
          ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
          : null

      const shiftDate = new Date(r.shift_date).toLocaleDateString("fr-CA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      const message = `✅ <b>Candidature acceptée</b>

Votre candidature a été acceptée!

📅 Date: ${shiftDate}
⏰ Quart: ${r.shift_type === "day" ? "Jour (7h-17h)" : "Nuit (17h-7h)"}${partialHours ? `\n⏱️ Heures: ${partialHours}` : ""}
👤 Remplace: ${r.replaced_name}`

      try {
        await sendTelegramMessage(prefs.telegram_chat_id, message)
        typesSent.push("telegram")
      } catch (telegramError) {
        console.error("[v0] Telegram sending failed:", telegramError)
      }
    }

    const allRejectedCandidates = await sql`
      SELECT 
        ra.id,
        ra.applicant_id,
        ra.status,
        u.first_name,
        u.last_name,
        np.notify_replacement_rejected
      FROM replacement_applications ra
      JOIN users u ON ra.applicant_id = u.id
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE ra.replacement_id = ${replacementId}
        AND ra.status = 'rejected'
    `

    console.log(
      "[v0] sendAssignmentNotification: ALL rejected candidates (before filtering):",
      allRejectedCandidates.length,
    )
    allRejectedCandidates.forEach((c) => {
      console.log("[v0] Rejected candidate:", {
        id: c.id,
        applicant_id: c.applicant_id,
        name: `${c.first_name} ${c.last_name}`,
        notify_replacement_rejected: c.notify_replacement_rejected,
      })
    })

    // Get rejected candidates to notify
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

    console.log(
      "[v0] sendAssignmentNotification: Found",
      rejectedCandidates.length,
      "rejected candidates (after filtering)",
    )

    for (const rejected of rejectedCandidates) {
      console.log("[v0] sendAssignmentNotification: Processing rejected candidate:", {
        applicant_id: rejected.applicant_id,
        name: `${rejected.first_name} ${rejected.last_name}`,
        enable_telegram: rejected.enable_telegram,
        has_telegram_chat_id: !!rejected.telegram_chat_id,
        notify_replacement_rejected: rejected.notify_replacement_rejected,
      })

      const rejectedFullName = `${rejected.first_name} ${rejected.last_name}`

      // In-app notification for rejected candidate
      if (rejected.enable_app !== false) {
        const partialHours =
          r.is_partial && r.start_time && r.end_time
            ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
            : null

        const message = partialHours
          ? `Votre candidature pour remplacer ${r.replaced_name} le ${new Date(r.shift_date).toLocaleDateString("fr-CA")} de ${partialHours} a été rejetée.`
          : `Votre candidature pour remplacer ${r.replaced_name} le ${new Date(r.shift_date).toLocaleDateString("fr-CA")} (${r.shift_type}) a été rejetée.`

        await sql`
          INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
          VALUES (
            ${rejected.applicant_id}, 
            ${"Candidature rejetée"}, 
            ${message}, 
            ${"replacement_rejected"}, 
            ${replacementId}, 
            ${"replacement"}
          )
        `
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
          } catch (emailError) {
            console.error("[v0] Email sending failed for rejected candidate:", emailError)
          }
        }
      }

      // Telegram notification for rejected candidate
      if (rejected.enable_telegram === true && rejected.telegram_chat_id) {
        console.log("[v0] sendAssignmentNotification: Sending Telegram to rejected candidate:", rejected.applicant_id)

        const partialHours =
          r.is_partial && r.start_time && r.end_time
            ? `${r.start_time.substring(0, 5)} - ${r.end_time.substring(0, 5)}`
            : null

        const shiftDate = new Date(r.shift_date).toLocaleDateString("fr-CA", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })

        const message = `❌ <b>Candidature refusée</b>

Votre candidature a été refusée.

📅 Date: ${shiftDate}
⏰ Quart: ${r.shift_type === "day" ? "Jour (7h-17h)" : "Nuit (17h-7h)"}${partialHours ? `\n⏱️ Heures: ${partialHours}` : ""}
👤 Remplace: ${r.replaced_name}`

        try {
          await sendTelegramMessage(rejected.telegram_chat_id, message)
          console.log(
            "[v0] sendAssignmentNotification: Telegram sent successfully to rejected candidate:",
            rejected.applicant_id,
          )
        } catch (telegramError) {
          console.error(
            "[v0] sendAssignmentNotification: Telegram sending failed for rejected candidate:",
            rejected.applicant_id,
            telegramError,
          )
        }
      } else {
        console.log(
          "[v0] sendAssignmentNotification: Telegram NOT sent to rejected candidate:",
          rejected.applicant_id,
          {
            reason: !rejected.enable_telegram ? "Telegram disabled" : "No chat_id",
          },
        )
      }
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

    console.log("[v0] sendAssignmentNotification: All notifications sent successfully")

    revalidatePath("/dashboard/replacements")

    return {
      success: true,
      typesSent,
      message: `Notifications envoyées (accepté: ${typesSent.join(", ")}, rejetés: ${rejectedCandidates.length} candidat(s))`,
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
