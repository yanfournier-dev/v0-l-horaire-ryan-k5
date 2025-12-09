"use server"

import { Resend } from "resend"
import { getEmailTemplateByType } from "@/app/actions/email-templates"

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn("[v0] RESEND_API_KEY not configured - emails will not be sent")
    return null
  }
  console.log("[v0] Resend client initialized successfully")
  return new Resend(apiKey)
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  if (process.env.VERCEL_ENV !== "production") {
    console.log("[v0] V0 PREVIEW - Skipping email send")
    return { success: true, skipped: true }
  }

  const resend = getResendClient()
  if (!resend) {
    return { success: false, error: "Email service not configured" }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "notifications@resend.dev",
      to,
      subject,
      html,
    })

    if (error) {
      console.error("[v0] PRODUCTION ERROR: Email send failed:", error)
      return { success: false, error }
    }

    console.log("[v0] PRODUCTION: Email sent successfully to:", to)
    return { success: true, data }
  } catch (error) {
    console.error("[v0] PRODUCTION ERROR: Email send exception:", error)
    return { success: false, error }
  }
}

export async function sendBatchEmails(
  emails: Array<{
    to: string
    subject: string
    html: string
  }>,
) {
  if (process.env.VERCEL_ENV !== "production") {
    console.log("[v0] V0 PREVIEW - Skipping batch emails")
    return { success: true, skipped: true, count: emails.length }
  }

  console.log("[v0] PRODUCTION: Starting batch email send for", emails.length, "recipients")

  const resend = getResendClient()
  if (!resend) {
    console.error("[v0] PRODUCTION ERROR: Resend client not initialized")
    return {
      success: false,
      error: { message: "Resend API key not configured" },
    }
  }

  try {
    const results = []
    const errors = []

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i]

      try {
        const { data, error } = await resend.emails.send({
          from: "notifications@resend.dev",
          to: email.to,
          subject: email.subject,
          html: email.html,
        })

        if (error) {
          console.error(`[v0] PRODUCTION ERROR: Email ${i + 1}/${emails.length} failed to ${email.to}:`, error)
          errors.push({ to: email.to, error })
        } else {
          console.log(`[v0] PRODUCTION: Email ${i + 1}/${emails.length} sent successfully to ${email.to}`)
          results.push({ to: email.to, data })
        }
      } catch (error: any) {
        console.error(`[v0] PRODUCTION ERROR: Email ${i + 1}/${emails.length} exception for ${email.to}:`, error)
        errors.push({ to: email.to, error: error.message })
      }

      // Add 100ms delay between emails to avoid rate limiting
      if (i < emails.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    return {
      success: errors.length === 0,
      sent: results.length,
      failed: errors.length,
      results,
      errors,
    }
  } catch (error: any) {
    console.error("[v0] PRODUCTION ERROR: Batch email exception:", error)
    return {
      success: false,
      error: {
        message: error.message || "Unknown error",
        statusCode: error.statusCode,
        name: error.name,
      },
    }
  }
}

function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g")
    result = result.replace(regex, value || "")
  }
  result = result.replace(/{{#if\s+(\w+)}}(.*?){{\/if}}/gs, (match, varName, content) => {
    return variables[varName] ? content : ""
  })
  return result
}

function getAppUrl(): string {
  const productionUrl = "https://v0-l-horaire-ryan.vercel.app"
  console.log("[v0] Using production URL in email template:", productionUrl)
  return productionUrl
}

function getFallbackTemplate(type: string, variables: Record<string, string>) {
  const appUrl = getAppUrl()

  const templates: Record<string, { subject: string; body: string }> = {
    replacement_available: {
      subject: "Remplacement disponible",
      body: `
        <h2 style="color: #1f2937;">Remplacement disponible</h2>
        <p>Bonjour ${variables.name},</p>
        <p>Un remplacement est disponible pour votre équipe :</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Date :</strong> ${variables.date}</p>
          <p style="margin: 5px 0;"><strong>Type de quart :</strong> ${variables.shiftType}</p>
          <p style="margin: 5px 0;"><strong>Pompier à remplacer :</strong> ${variables.firefighterToReplace}</p>
          ${variables.isPartial ? `<p style="margin: 5px 0; color: #f97316;"><strong>Remplacement partiel :</strong> ${variables.partialHours}</p>` : ""}
          ${
            variables.deadlineLabel
              ? variables.deadlineLabel === "Sans délai"
                ? `<p style="margin: 10px 0 5px 0; padding: 10px; background-color: #fee2e2; border: 2px solid #dc2626; border-radius: 5px; color: #dc2626; font-weight: bold; font-size: 15px;">
                     ⚠️ <strong>Sans délai</strong> - Postulez immédiatement ⚠️
                   </p>`
                : `<p style="margin: 5px 0;"><strong>Délai :</strong> ${variables.deadlineLabel}</p>`
              : ""
          }
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${appUrl}/dashboard/replacements" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Voir les remplacements</a>
        </div>
      `,
    },
    application_approved: {
      subject: "Candidature approuvée",
      body: `
        <h2 style="color: #10b981;">Candidature approuvée</h2>
        <p>Bonjour ${variables.name},</p>
        <p>Votre candidature pour le remplacement suivant a été approuvée :</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Date :</strong> ${variables.date}</p>
          <p style="margin: 5px 0;"><strong>Type de quart :</strong> ${variables.shiftType}</p>
          <p style="margin: 5px 0;"><strong>Pompier à remplacer :</strong> ${variables.firefighterToReplace}</p>
          ${variables.isPartial ? `<p style="margin: 5px 0; color: #f97316;"><strong>Remplacement partiel :</strong> ${variables.partialHours}</p>` : ""}
        </div>
        <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir mon horaire</a>
      `,
    },
    application_rejected: {
      subject: "Candidature refusée",
      body: `
        <h2 style="color: #ef4444;">Candidature refusée</h2>
        <p>Bonjour ${variables.name},</p>
        <p>Votre candidature pour le remplacement suivant a été refusée :</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Date :</strong> ${variables.date}</p>
          <p style="margin: 5px 0;"><strong>Type de quart :</strong> ${variables.shiftType}</p>
          <p style="margin: 5px 0;"><strong>Pompier à remplacer :</strong> ${variables.firefighterToReplace}</p>
          ${variables.isPartial ? `<p style="margin: 5px 0; color: #f97316;"><strong>Remplacement partiel :</strong> ${variables.partialHours}</p>` : ""}
        </div>
        <a href="${appUrl}/dashboard/replacements" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir les remplacements disponibles</a>
      `,
    },
    exchange_request: {
      subject: "Demande d'échange de quart",
      body: `
        <h2 style="color: #1f2937;">Demande d'échange de quart</h2>
        <p>Bonjour ${variables.targetName},</p>
        <p>${variables.requesterName} souhaite échanger de quart avec vous :</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Date du demandeur :</strong> ${variables.requesterDate}</p>
          <p style="margin: 5px 0;"><strong>Type de quart du demandeur :</strong> ${variables.requesterShiftType}</p>
          <p style="margin: 5px 0;"><strong>Votre date :</strong> ${variables.targetDate}</p>
          <p style="margin: 5px 0;"><strong>Votre type de quart :</strong> ${variables.targetShiftType}</p>
          ${variables.isPartial ? `<p style="margin: 5px 0; color: #f97316;"><strong>Échange partiel :</strong> ${variables.requesterPartialHours} <-> ${variables.targetPartialHours}</p>` : ""}
        </div>
        <a href="${appUrl}/dashboard/exchanges" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir les demandes d'échange</a>
      `,
    },
    exchange_request_confirmation: {
      subject: "Demande d'échange envoyée",
      body: `
        <h2 style="color: #10b981;">Demande d'échange envoyée</h2>
        <p>Bonjour ${variables.requesterName},</p>
        <p>Votre demande d'échange de quart avec ${variables.targetName} a été envoyée avec succès :</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Votre date :</strong> ${variables.requesterDate}</p>
          <p style="margin: 5px 0;"><strong>Votre type de quart :</strong> ${variables.requesterShiftType}</p>
          <p style="margin: 5px 0;"><strong>Date de ${variables.targetName} :</strong> ${variables.targetDate}</p>
          <p style="margin: 5px 0;"><strong>Type de quart de ${variables.targetName} :</strong> ${variables.targetShiftType}</p>
          ${variables.isPartial ? `<p style="margin: 5px 0; color: #f97316;"><strong>Échange partiel :</strong> ${variables.requesterPartialHours} <-> ${variables.targetPartialHours}</p>` : ""}
        </div>
        <p style="margin: 20px 0;">Vous serez notifié lorsqu'un gestionnaire traitera votre demande.</p>
        <a href="${appUrl}/dashboard/exchanges" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir mes demandes d'échange</a>
      `,
    },
    exchange_approved: {
      subject: "Échange de quart approuvé",
      body: `
        <h2 style="color: #10b981;">Échange de quart approuvé</h2>
        <p>Bonjour ${variables.name},</p>
        <p>L'échange de quart avec ${variables.otherName} a été approuvé :</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Votre date :</strong> ${variables.yourDate}</p>
          <p style="margin: 5px 0;"><strong>Votre type de quart :</strong> ${variables.yourShiftType}</p>
          <p style="margin: 5px 0;"><strong>Date de l'autre :</strong> ${variables.otherDate}</p>
          <p style="margin: 5px 0;"><strong>Type de quart de l'autre :</strong> ${variables.otherShiftType}</p>
          ${variables.isPartial ? `<p style="margin: 5px 0; color: #f97316;"><strong>Échange partiel :</strong> ${variables.yourPartialHours} <-> ${variables.otherPartialHours}</p>` : ""}
        </div>
        <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir mon horaire</a>
      `,
    },
    exchange_rejected: {
      subject: "Échange de quart refusé",
      body: `
        <h2 style="color: #ef4444;">Échange de quart refusé</h2>
        <p>Bonjour ${variables.name},</p>
        <p>L'échange de quart avec ${variables.otherName} a été refusé pour la raison suivante :</p>
        <p style="margin: 20px 0; color: #ef4444;"><strong>Raison :</strong> ${variables.reason}</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Votre date :</strong> ${variables.yourDate}</p>
          <p style="margin: 5px 0;"><strong>Votre type de quart :</strong> ${variables.yourShiftType}</p>
          <p style="margin: 5px 0;"><strong>Date de l'autre :</strong> ${variables.otherDate}</p>
          <p style="margin: 5px 0;"><strong>Type de quart de l'autre :</strong> ${variables.otherShiftType}</p>
          ${variables.isPartial ? `<p style="margin: 5px 0; color: #f97316;"><strong>Échange partiel :</strong> ${variables.yourPartialHours} <-> ${variables.otherPartialHours}</p>` : ""}
        </div>
        <a href="${appUrl}/dashboard/exchanges" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir les demandes d'échange</a>
      `,
    },
  }

  const template = templates[type]
  if (!template) {
    return null
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${template.body}
        <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
          <p>L'horaire Ryan - Gestion des horaires des pompiers</p>
        </div>
      </body>
    </html>
  `

  return { subject: template.subject, html }
}

async function getEmailFromTemplate(type: string, variables: Record<string, string>) {
  const template = await getEmailTemplateByType(type)

  if (!template) {
    console.log(`[v0] No database template found for type: ${type}, using fallback`)
    return getFallbackTemplate(type, variables)
  }

  const appUrl = getAppUrl()
  const allVariables = { ...variables, appUrl }

  const subject = replaceVariables(template.subject, allVariables)
  const body = replaceVariables(template.body, allVariables)

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${body}
        <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
          <p>L'horaire Ryan - Gestion des horaires des pompiers</p>
        </div>
      </body>
    </html>
  `

  return { subject, html }
}

function translateShiftType(shiftType: string): string {
  const translations: Record<string, string> = {
    day: "Jour",
    night: "Nuit",
    jour: "Jour",
    nuit: "Nuit",
  }
  return translations[shiftType.toLowerCase()] || shiftType
}

export async function getReplacementAvailableEmail(
  name: string,
  date: string,
  shiftType: string,
  firefighterToReplace: string,
  isPartial?: boolean,
  partialHours?: string,
  applyToken?: string,
  deadlineLabel?: string,
) {
  console.log("[v0] getReplacementAvailableEmail called with deadlineLabel:", deadlineLabel)

  const translatedShiftType = translateShiftType(shiftType)

  const subject =
    deadlineLabel === "Sans délai"
      ? "🚨 SANS DÉLAI - Remplacement"
      : deadlineLabel
        ? `Remplacement - Délai: ${deadlineLabel}`
        : "Remplacement disponible"

  console.log("[v0] Email subject generated:", subject)

  const emailContent = await getEmailFromTemplate("replacement_available", {
    name,
    date,
    shiftType: translatedShiftType,
    firefighterToReplace,
    isPartial: isPartial ? "true" : "",
    partialHours: partialHours || "",
    applyToken: applyToken || "",
    deadlineLabel: deadlineLabel || "",
  })

  console.log("[v0] Email content generated with deadlineLabel in variables:", deadlineLabel)

  return {
    subject,
    html: emailContent.html,
  }
}

export async function getApplicationApprovedEmail(
  name: string,
  date: string,
  shiftType: string,
  firefighterToReplace: string,
  isPartial?: boolean,
  partialHours?: string,
) {
  const translatedShiftType = translateShiftType(shiftType)
  return await getEmailFromTemplate("application_approved", {
    name,
    date,
    shiftType: translatedShiftType,
    firefighterToReplace,
    isPartial: isPartial ? "true" : "",
    partialHours: partialHours || "",
  })
}

export async function getApplicationRejectedEmail(
  name: string,
  date: string,
  shiftType: string,
  firefighterToReplace: string,
  isPartial?: boolean,
  partialHours?: string,
) {
  const translatedShiftType = translateShiftType(shiftType)
  return await getEmailFromTemplate("application_rejected", {
    name,
    date,
    shiftType: translatedShiftType,
    firefighterToReplace,
    isPartial: isPartial ? "true" : "",
    partialHours: partialHours || "",
  })
}

export async function getExchangeRequestEmail(
  targetName: string,
  requesterName: string,
  requesterDate: string,
  requesterShiftType: string,
  targetDate: string,
  targetShiftType: string,
  isPartial?: boolean,
  requesterPartialHours?: string,
  targetPartialHours?: string,
) {
  const translatedRequesterShiftType = translateShiftType(requesterShiftType)
  const translatedTargetShiftType = translateShiftType(targetShiftType)

  return await getEmailFromTemplate("exchange_request", {
    targetName,
    requesterName,
    requesterDate,
    requesterShiftType: translatedRequesterShiftType,
    targetDate,
    targetShiftType: translatedTargetShiftType,
    isPartial: isPartial ? "true" : "",
    requesterPartialHours: requesterPartialHours || "",
    targetPartialHours: targetPartialHours || "",
  })
}

export async function getExchangeRequestConfirmationEmail(
  requesterName: string,
  targetName: string,
  requesterDate: string,
  requesterShiftType: string,
  targetDate: string,
  targetShiftType: string,
  isPartial?: boolean,
  requesterPartialHours?: string,
  targetPartialHours?: string,
) {
  const translatedRequesterShiftType = translateShiftType(requesterShiftType)
  const translatedTargetShiftType = translateShiftType(targetShiftType)

  return await getEmailFromTemplate("exchange_request_confirmation", {
    requesterName,
    targetName,
    requesterDate,
    requesterShiftType: translatedRequesterShiftType,
    targetDate,
    targetShiftType: translatedTargetShiftType,
    isPartial: isPartial ? "true" : "",
    requesterPartialHours: requesterPartialHours || "",
    targetPartialHours: targetPartialHours || "",
  })
}

export async function getExchangeApprovedEmail(
  name: string,
  otherName: string,
  yourDate: string,
  yourShiftType: string,
  otherDate: string,
  otherShiftType: string,
  isPartial?: boolean,
  yourPartialHours?: string,
  otherPartialHours?: string,
) {
  const translatedYourShiftType = translateShiftType(yourShiftType)
  const translatedOtherShiftType = translateShiftType(otherShiftType)

  return await getEmailFromTemplate("exchange_approved", {
    firefighterName: name,
    otherFirefighterName: otherName,
    newDate: yourDate,
    newShiftType: translatedYourShiftType,
    oldDate: otherDate,
    oldShiftType: translatedOtherShiftType,
    name,
    otherName,
    yourDate,
    yourShiftType: translatedYourShiftType,
    otherDate,
    otherShiftType: translatedOtherShiftType,
    isPartial: isPartial ? "true" : "",
    yourPartialHours: yourPartialHours || "",
    otherPartialHours: otherPartialHours || "",
  })
}

export async function getExchangeRejectedEmail(
  name: string,
  otherName: string,
  yourDate: string,
  yourShiftType: string,
  otherDate: string,
  otherShiftType: string,
  reason?: string,
  isPartial?: boolean,
  yourPartialHours?: string,
  otherPartialHours?: string,
) {
  const translatedYourShiftType = translateShiftType(yourShiftType)
  const translatedOtherShiftType = translateShiftType(otherShiftType)

  return await getEmailFromTemplate("exchange_rejected", {
    name,
    otherName,
    yourDate,
    yourShiftType: translatedYourShiftType,
    otherDate,
    otherShiftType: translatedOtherShiftType,
    reason: reason || "",
    isPartial: isPartial ? "true" : "",
    yourPartialHours: yourPartialHours || "",
    otherPartialHours: otherPartialHours || "",
  })
}
