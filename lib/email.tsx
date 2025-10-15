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
  console.log("[v0] ========== EMAIL SEND ATTEMPT ==========")
  console.log("[v0] To:", to)
  console.log("[v0] Subject:", subject)

  const resend = getResendClient()
  if (!resend) {
    console.log("[v0] Email not sent - Resend not configured")
    return { success: false, error: "Email service not configured" }
  }

  let verifiedEmail = process.env.RESEND_VERIFIED_EMAIL
  if (verifiedEmail) {
    // Remove "RESEND_VERIFIED_EMAIL=" prefix if present
    verifiedEmail = verifiedEmail.replace(/^RESEND_VERIFIED_EMAIL=/i, "").trim()
  }

  console.log("[v0] RESEND_VERIFIED_EMAIL is set:", !!verifiedEmail)
  if (verifiedEmail) {
    console.log("[v0] Verified email value:", verifiedEmail)
    console.log("[v0] Recipient matches verified email:", to === verifiedEmail)
  }

  if (verifiedEmail && to !== verifiedEmail) {
    console.log("[v0] Resend is in test mode - skipping email send")
    console.log("[v0] Verified email:", verifiedEmail)
    console.log("[v0] Email would have been sent to:", to)
    console.log("[v0] To send emails to all users, verify a domain at resend.com/domains")
    return {
      success: false,
      error: "Test mode restriction - email not sent",
      isTestModeRestriction: true,
    }
  }

  try {
    console.log("[v0] Calling Resend API...")
    const { data, error } = await resend.emails.send({
      from: "L'horaire Ryan <notifications@resend.dev>",
      to,
      subject,
      html,
    })

    if (error) {
      console.error("[v0] Resend API returned error:", error)
      // Check if this is a test mode restriction (403 error)
      if (error.statusCode === 403 && error.message?.includes("testing emails")) {
        console.log("[v0] Resend is in test mode - emails can only be sent to:", verifiedEmail || "your verified email")
        console.log("[v0] Email would have been sent to:", to)
        console.log("[v0] To send emails to all users, verify a domain at resend.com/domains")
        return { success: false, error: "Test mode restriction", isTestModeRestriction: true }
      }
      console.error("[v0] Email error:", error)
      return { success: false, error }
    }

    console.log("[v0] Email sent successfully! Data:", data)
    console.log("[v0] ========================================")
    return { success: true, data }
  } catch (error) {
    console.error("[v0] Email send exception:", error)
    console.log("[v0] ========================================")
    return { success: false, error }
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
        </div>
        ${
          variables.applyToken
            ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}/apply-replacement?token=${variables.applyToken}" 
               style="display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Postuler maintenant
            </a>
            <p style="margin-top: 10px; font-size: 14px; color: #6b7280;">
              Cliquez sur ce bouton pour postuler directement
            </p>
          </div>
        `
            : ""
        }
        <a href="${appUrl}/dashboard/replacements" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir les remplacements</a>
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
) {
  const translatedShiftType = translateShiftType(shiftType)
  return await getEmailFromTemplate("replacement_available", {
    name,
    date,
    shiftType: translatedShiftType,
    firefighterToReplace,
    isPartial: isPartial ? "true" : "",
    partialHours: partialHours || "",
    applyToken: applyToken || "",
  })
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
    // Also include original names for fallback template
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
