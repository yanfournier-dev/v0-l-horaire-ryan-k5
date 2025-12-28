"use server"

import { sendEmail } from "@/lib/email"

export async function testEmailAction(email: string) {
  console.log("[v0] Test email action called for:", email)

  const result = await sendEmail({
    to: email,
    subject: "Test - Horaire SSIV",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✉️ Email de test</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Bonjour,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Ceci est un email de test du système Horaire SSIV.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <p style="margin: 5px 0;">✅ Le système d'envoi d'emails fonctionne correctement!</p>
              <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Si vous recevez cet email, cela signifie que Resend est bien configuré.</p>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 30px;">
              Vous pouvez maintenant activer les notifications par email dans vos préférences.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
            <p>Horaire SSIV - Gestion des horaires des pompiers</p>
          </div>
        </body>
      </html>
    `,
  })

  console.log("[v0] Test email result:", result)

  if (result.success) {
    return {
      success: true,
      message: "Email envoyé avec succès! Vérifiez votre boîte de réception.",
    }
  } else {
    return {
      success: false,
      message: `Erreur lors de l'envoi: ${JSON.stringify(result.error)}`,
    }
  }
}
