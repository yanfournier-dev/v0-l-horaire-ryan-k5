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
  console.log("[v0] Attempting to send email to:", to, "Subject:", subject)

  const resend = getResendClient()
  if (!resend) {
    console.log("[v0] Email not sent - Resend not configured")
    return { success: false, error: "Email service not configured" }
  }

  try {
    console.log("[v0] Sending email via Resend...")
    const { data, error } = await resend.emails.send({
      from: "L'horaire Ryan <notifications@resend.dev>",
      to,
      subject,
      html,
    })

    if (error) {
      if (error.statusCode === 403 && error.message?.includes("testing emails")) {
        console.log("[v0] Resend test mode restriction - email not sent to:", to)
        return { success: false, error, isTestModeRestriction: true }
      }
      console.error("[v0] Email error:", error)
      return { success: false, error }
    }

    console.log("[v0] Email sent successfully:", data)
    return { success: true, data }
  } catch (error) {
    console.error("[v0] Email send error:", error)
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
