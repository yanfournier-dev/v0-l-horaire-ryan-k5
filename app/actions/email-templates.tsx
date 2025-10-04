"use server"

import { neon } from "@neondatabase/serverless"
import { getSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

export interface EmailTemplate {
  id: number
  type: string
  name: string
  subject: string
  body: string
  variables: string[]
  description: string | null
  created_at: Date
  updated_at: Date
}

export async function getAllEmailTemplates(): Promise<EmailTemplate[]> {
  const user = await getSession()
  if (!user || !user.is_admin) {
    throw new Error("Unauthorized")
  }

  const templates = await sql`
    SELECT 
      id,
      type,
      name,
      subject,
      body,
      variables,
      description,
      created_at,
      updated_at
    FROM email_templates
    ORDER BY name ASC
  `

  return templates.map((t: any) => ({
    ...t,
    variables: t.variables || [],
  }))
}

export async function getEmailTemplateByType(type: string): Promise<EmailTemplate | null> {
  const templates = await sql`
    SELECT 
      id,
      type,
      name,
      subject,
      body,
      variables,
      description,
      created_at,
      updated_at
    FROM email_templates
    WHERE type = ${type}
  `

  if (templates.length === 0) {
    return null
  }

  const template = templates[0]
  return {
    ...template,
    variables: template.variables || [],
  }
}

export async function updateEmailTemplate(
  id: number,
  data: {
    subject: string
    body: string
  },
): Promise<{ success: boolean; error?: string }> {
  const user = await getSession()
  if (!user || !user.is_admin) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    await sql`
      UPDATE email_templates
      SET 
        subject = ${data.subject},
        body = ${data.body},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `

    return { success: true }
  } catch (error) {
    console.error("[v0] Error updating email template:", error)
    return { success: false, error: "Failed to update template" }
  }
}

export async function resetEmailTemplate(id: number): Promise<{ success: boolean; error?: string }> {
  const user = await getSession()
  if (!user || !user.is_admin) {
    return { success: false, error: "Unauthorized" }
  }

  // This would require storing default templates separately
  // For now, we'll just return an error
  return { success: false, error: "Reset functionality not yet implemented" }
}

export async function addPartialVariablesToTemplates(): Promise<{
  success: boolean
  error?: string
  message?: string
}> {
  const user = await getSession()
  if (!user || !user.is_admin) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    console.log("[v0] Starting to update email templates with firefighter to replace...")

    await sql`
      UPDATE email_templates
      SET 
        variables = '["name", "date", "shiftType", "firefighterToReplace", "isPartial", "partialHours"]'::jsonb,
        body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #1f2937; margin-bottom: 20px;">🔔 Nouveau remplacement disponible</h2>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Bonjour <strong>{{name}}</strong>,</p>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Un nouveau remplacement est disponible :</p>
    <div style="background-color: #f3f4f6; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 5px 0; color: #1f2937;"><strong>Date :</strong> {{date}}</p>
      <p style="margin: 5px 0; color: #1f2937;"><strong>Type de quart :</strong> {{shiftType}}</p>
      <p style="margin: 5px 0; color: #1f2937;"><strong>Pompier à remplacer :</strong> {{firefighterToReplace}}</p>
      {{#if isPartial}}<p style="margin: 5px 0; color: #ea580c;"><strong>⏰ Remplacement partiel :</strong> {{partialHours}}</p>{{/if}}
    </div>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Connectez-vous à l''application pour postuler.</p>
    <div style="margin-top: 30px; text-align: center;">
      <a href="{{appUrl}}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">Voir le remplacement</a>
    </div>
  </div>
</div>',
        updated_at = CURRENT_TIMESTAMP
      WHERE type = 'replacement_available'
    `
    console.log("[v0] Updated replacement_available template")

    await sql`
      UPDATE email_templates
      SET 
        variables = '["name", "date", "shiftType", "firefighterToReplace", "isPartial", "partialHours"]'::jsonb,
        body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #059669; margin-bottom: 20px;">✅ Candidature acceptée</h2>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Bonjour <strong>{{name}}</strong>,</p>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Votre candidature a été acceptée pour le remplacement suivant :</p>
    <div style="background-color: #f3f4f6; border-left: 4px solid #059669; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 5px 0; color: #1f2937;"><strong>Date :</strong> {{date}}</p>
      <p style="margin: 5px 0; color: #1f2937;"><strong>Type de quart :</strong> {{shiftType}}</p>
      <p style="margin: 5px 0; color: #1f2937;"><strong>Pompier à remplacer :</strong> {{firefighterToReplace}}</p>
      {{#if isPartial}}<p style="margin: 5px 0; color: #ea580c;"><strong>⏰ Remplacement partiel :</strong> {{partialHours}}</p>{{/if}}
    </div>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Merci de votre disponibilité !</p>
  </div>
</div>',
        updated_at = CURRENT_TIMESTAMP
      WHERE type = 'application_approved'
    `
    console.log("[v0] Updated application_approved template")

    await sql`
      UPDATE email_templates
      SET 
        variables = '["name", "date", "shiftType", "firefighterToReplace", "isPartial", "partialHours"]'::jsonb,
        body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #dc2626; margin-bottom: 20px;">❌ Candidature refusée</h2>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Bonjour <strong>{{name}}</strong>,</p>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Votre candidature pour le remplacement suivant a été refusée :</p>
    <div style="background-color: #f3f4f6; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 5px 0; color: #1f2937;"><strong>Date :</strong> {{date}}</p>
      <p style="margin: 5px 0; color: #1f2937;"><strong>Type de quart :</strong> {{shiftType}}</p>
      <p style="margin: 5px 0; color: #1f2937;"><strong>Pompier à remplacer :</strong> {{firefighterToReplace}}</p>
      {{#if isPartial}}<p style="margin: 5px 0; color: #ea580c;"><strong>⏰ Remplacement partiel :</strong> {{partialHours}}</p>{{/if}}
    </div>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Merci de votre intérêt.</p>
  </div>
</div>',
        updated_at = CURRENT_TIMESTAMP
      WHERE type = 'application_rejected'
    `
    console.log("[v0] Updated application_rejected template")

    console.log("[v0] Successfully updated all email templates with firefighter to replace")
    return {
      success: true,
      message:
        "Les templates d'email ont été mis à jour pour afficher le nom du pompier à remplacer au lieu de l'équipe",
    }
  } catch (error) {
    console.error("[v0] Error updating email templates:", error)
    return { success: false, error: "Erreur lors de la mise à jour des templates" }
  }
}
