"use server"

import { Resend } from "resend"

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

export function getReplacementAvailableEmail(name: string, date: string, shiftType: string, teamName: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  return {
    subject: "🚨 Remplacement disponible",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Remplacement disponible</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Bonjour ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Un remplacement est disponible pour votre équipe <strong>${teamName}</strong>.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
              <p style="margin: 5px 0;"><strong>Type de quart:</strong> ${shiftType}</p>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 30px;">
              Connectez-vous pour accepter ce remplacement.
            </p>
            
            <div style="text-align: center;">
              <a href="${appUrl}/dashboard/replacements" 
                 style="display: inline-block; background: #dc2626; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Voir les remplacements
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
            <p>L'horaire Ryan - Gestion des horaires des pompiers</p>
          </div>
        </body>
      </html>
    `,
  }
}

export function getReplacementAcceptedEmail(name: string, date: string, shiftType: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  return {
    subject: "✅ Remplacement accepté",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Remplacement accepté</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Bonjour ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Votre remplacement a été accepté avec succès!
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
              <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
              <p style="margin: 5px 0;"><strong>Type de quart:</strong> ${shiftType}</p>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 30px;">
              Ce quart a été ajouté à votre horaire.
            </p>
            
            <div style="text-align: center;">
              <a href="${appUrl}/dashboard/calendar" 
                 style="display: inline-block; background: #16a34a; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Voir mon horaire
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
            <p>L'horaire Ryan - Gestion des horaires des pompiers</p>
          </div>
        </body>
      </html>
    `,
  }
}

export function getLeaveApprovedEmail(name: string, startDate: string, endDate: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  return {
    subject: "✅ Congé approuvé",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Congé approuvé</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Bonjour ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Bonne nouvelle! Votre demande de congé a été approuvée.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
              <p style="margin: 5px 0;"><strong>Du:</strong> ${startDate}</p>
              <p style="margin: 5px 0;"><strong>Au:</strong> ${endDate}</p>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 30px;">
              Profitez bien de votre congé!
            </p>
            
            <div style="text-align: center;">
              <a href="${appUrl}/dashboard/leaves" 
                 style="display: inline-block; background: #16a34a; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Voir mes congés
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
            <p>L'horaire Ryan - Gestion des horaires des pompiers</p>
          </div>
        </body>
      </html>
    `,
  }
}

export function getLeaveRejectedEmail(name: string, startDate: string, endDate: string, reason?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  return {
    subject: "❌ Congé refusé",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">❌ Congé refusé</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Bonjour ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Malheureusement, votre demande de congé a été refusée.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p style="margin: 5px 0;"><strong>Du:</strong> ${startDate}</p>
              <p style="margin: 5px 0;"><strong>Au:</strong> ${endDate}</p>
              ${reason ? `<p style="margin: 15px 0 5px 0;"><strong>Raison:</strong></p><p style="margin: 5px 0;">${reason}</p>` : ""}
            </div>
            
            <p style="font-size: 16px; margin-bottom: 30px;">
              Contactez votre superviseur pour plus d'informations.
            </p>
            
            <div style="text-align: center;">
              <a href="${appUrl}/dashboard/leaves" 
                 style="display: inline-block; background: #dc2626; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Voir mes congés
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
            <p>L'horaire Ryan - Gestion des horaires des pompiers</p>
          </div>
        </body>
      </html>
    `,
  }
}

export function getApplicationApprovedEmail(name: string, date: string, shiftType: string, teamName: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  return {
    subject: "✅ Candidature acceptée",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Candidature acceptée</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Bonjour ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Félicitations! Votre candidature pour le remplacement a été acceptée.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
              <p style="margin: 5px 0;"><strong>Équipe:</strong> ${teamName}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
              <p style="margin: 5px 0;"><strong>Type de quart:</strong> ${shiftType}</p>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 30px;">
              Ce quart a été ajouté à votre horaire. Merci de votre disponibilité!
            </p>
            
            <div style="text-align: center;">
              <a href="${appUrl}/dashboard/calendar" 
                 style="display: inline-block; background: #16a34a; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Voir mon horaire
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
            <p>L'horaire Ryan - Gestion des horaires des pompiers</p>
          </div>
        </body>
      </html>
    `,
  }
}
