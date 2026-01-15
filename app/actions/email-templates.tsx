"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/app/actions/auth"

import type { EmailTemplate } from "@/app/actions/email-templates"

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

export async function syncEmailTemplatesFromCode(): Promise<{
  success: boolean
  error?: string
  message?: string
  updated?: number
}> {
  const user = await getSession()
  if (!user || !user.is_admin) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    const fallbackTemplates = [
      {
        type: "replacement_available",
        name: "Remplacement disponible",
        subject: "Remplacement disponible",
        body: `<h2 style="color: #1f2937;">Remplacement disponible</h2>
<p>Bonjour {{name}},</p>
<p>Un remplacement est disponible pour votre équipe :</p>
<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p style="margin: 5px 0;"><strong>Date :</strong> {{date}}</p>
  <p style="margin: 5px 0;"><strong>Type de quart :</strong> {{shiftType}}</p>
  <p style="margin: 5px 0;"><strong>Pompier à remplacer :</strong> {{firefighterToReplace}}</p>
  {{#if isPartial}}<p style="margin: 5px 0; color: #f97316;"><strong>Remplacement partiel :</strong> {{partialHours}}</p>{{/if}}
</div>
{{#if applyToken}}
<div style="text-align: center; margin: 30px 0;">
  <a href="{{appUrl}}/apply-replacement?token={{applyToken}}" 
     style="display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
    Postuler maintenant
  </a>
  <p style="margin-top: 10px; font-size: 14px; color: #6b7280;">
    Cliquez sur ce bouton pour postuler directement
  </p>
</div>
{{/if}}
<a href="{{appUrl}}/dashboard/replacements" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir les remplacements</a>`,
        variables: ["name", "date", "shiftType", "firefighterToReplace", "isPartial", "partialHours", "applyToken"],
        description: "Email envoyé lorsqu'un nouveau remplacement est disponible",
      },
      {
        type: "application_approved",
        name: "Candidature approuvée",
        subject: "Candidature approuvée",
        body: `<h2 style="color: #10b981;">Candidature approuvée</h2>
<p>Bonjour {{name}},</p>
<p>Votre candidature pour le remplacement suivant a été approuvée :</p>
<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p style="margin: 5px 0;"><strong>Date :</strong> {{date}}</p>
  <p style="margin: 5px 0;"><strong>Type de quart :</strong> {{shiftType}}</p>
  <p style="margin: 5px 0;"><strong>Pompier à remplacer :</strong> {{firefighterToReplace}}</p>
  {{#if isPartial}}<p style="margin: 5px 0; color: #f97316;"><strong>Remplacement partiel :</strong> {{partialHours}}</p>{{/if}}
</div>
<a href="{{appUrl}}/dashboard" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir mon horaire</a>`,
        variables: ["name", "date", "shiftType", "firefighterToReplace", "isPartial", "partialHours"],
        description: "Email envoyé lorsqu'une candidature est approuvée",
      },
      {
        type: "application_rejected",
        name: "Candidature refusée",
        subject: "Candidature refusée",
        body: `<h2 style="color: #ef4444;">Candidature refusée</h2>
<p>Bonjour {{name}},</p>
<p>Votre candidature pour le remplacement suivant a été refusée :</p>
<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p style="margin: 5px 0;"><strong>Date :</strong> {{date}}</p>
  <p style="margin: 5px 0;"><strong>Type de quart :</strong> {{shiftType}}</p>
  <p style="margin: 5px 0;"><strong>Pompier à remplacer :</strong> {{firefighterToReplace}}</p>
  {{#if isPartial}}<p style="margin: 5px 0; color: #f97316;"><strong>Remplacement partiel :</strong> {{partialHours}}</p>{{/if}}
</div>
<a href="{{appUrl}}/dashboard/replacements" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir les remplacements disponibles</a>`,
        variables: ["name", "date", "shiftType", "firefighterToReplace", "isPartial", "partialHours"],
        description: "Email envoyé lorsqu'une candidature est refusée",
      },
      {
        type: "exchange_request",
        name: "Demande d'échange de quart",
        subject: "Demande d'échange de quart",
        body: `<h2 style="color: #1f2937;">Demande d'échange de quart</h2>
<p>Bonjour {{targetName}},</p>
<p>{{requesterName}} souhaite échanger de quart avec vous :</p>
<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p style="margin: 5px 0;"><strong>Date du demandeur :</strong> {{requesterDate}}</p>
  <p style="margin: 5px 0;"><strong>Type de quart du demandeur :</strong> {{requesterShiftType}}</p>
  <p style="margin: 5px 0;"><strong>Votre date :</strong> {{targetDate}}</p>
  <p style="margin: 5px 0;"><strong>Votre type de quart :</strong> {{targetShiftType}}</p>
  {{#if isPartial}}<p style="margin: 5px 0; color: #f97316;"><strong>Échange partiel :</strong> {{requesterPartialHours}} <-> {{targetPartialHours}}</p>{{/if}}
</div>
<a href="{{appUrl}}/dashboard/exchanges" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir les demandes d'échange</a>`,
        variables: [
          "targetName",
          "requesterName",
          "requesterDate",
          "requesterShiftType",
          "targetDate",
          "targetShiftType",
          "isPartial",
          "requesterPartialHours",
          "targetPartialHours",
        ],
        description: "Email envoyé au pompier ciblé lorsqu'une demande d'échange est créée",
      },
      {
        type: "exchange_request_confirmation",
        name: "Confirmation de demande d'échange",
        subject: "Demande d'échange envoyée",
        body: `<h2 style="color: #10b981;">Demande d'échange envoyée</h2>
<p>Bonjour {{requesterName}},</p>
<p>Votre demande d'échange de quart avec {{targetName}} a été envoyée avec succès :</p>
<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p style="margin: 5px 0; color: #1f2937;"><strong>Votre date :</strong> {{requesterDate}}</p>
  <p style="margin: 5px 0; color: #1f2937;"><strong>Votre type de quart :</strong> {{requesterShiftType}}</p>
  <p style="margin: 5px 0; color: #1f2937;"><strong>Date de {{targetName}} :</strong> {{targetDate}}</p>
  <p style="margin: 5px 0; color: #1f2937;"><strong>Type de quart de {{targetName}} :</strong> {{targetShiftType}}</p>
  {{#if isPartial}}<p style="margin: 5px 0; color: #f97316;"><strong>Échange partiel :</strong> {{requesterPartialHours}} <-> {{targetPartialHours}}</p>{{/if}}
</div>
<p style="margin: 20px 0;">Vous serez notifié lorsqu'un gestionnaire traitera votre demande.</p>
<a href="{{appUrl}}/dashboard/exchanges" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir mes demandes d'échange</a>`,
        variables: [
          "requesterName",
          "targetName",
          "requesterDate",
          "requesterShiftType",
          "targetDate",
          "targetShiftType",
          "isPartial",
          "requesterPartialHours",
          "targetPartialHours",
        ],
        description: "Email de confirmation envoyé au demandeur lorsqu'une demande d'échange est créée",
      },
      {
        type: "exchange_approved",
        name: "Échange de quart approuvé",
        subject: "Échange de quart approuvé",
        body: `<h2 style="color: #10b981;">Échange de quart approuvé</h2>
<p>Bonjour {{name}},</p>
<p>L'échange de quart avec {{otherName}} a été approuvé :</p>
<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p style="margin: 5px 0; color: #1f2937;"><strong>Votre date :</strong> {{yourDate}}</p>
  <p style="margin: 5px 0; color: #1f2937;"><strong>Votre type de quart :</strong> {{yourShiftType}}</p>
  <p style="margin: 5px 0; color: #1f2937;"><strong>Date de l'autre :</strong> {{otherDate}}</p>
  <p style="margin: 5px 0; color: #1f2937;"><strong>Type de quart de l'autre :</strong> {{otherShiftType}}</p>
  {{#if isPartial}}<p style="margin: 5px 0; color: #f97316;"><strong>Échange partiel :</strong> {{yourPartialHours}} <-> {{otherPartialHours}}</p>{{/if}}
</div>
<a href="{{appUrl}}/dashboard" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir mon horaire</a>`,
        variables: [
          "name",
          "otherName",
          "yourDate",
          "yourShiftType",
          "otherDate",
          "otherShiftType",
          "isPartial",
          "yourPartialHours",
          "otherPartialHours",
        ],
        description: "Email envoyé aux deux pompiers lorsqu'un échange est approuvé",
      },
      {
        type: "exchange_rejected",
        name: "Échange de quart refusé",
        subject: "Échange de quart refusé",
        body: `<h2 style="color: #ef4444;">Échange de quart refusé</h2>
<p>Bonjour {{name}},</p>
<p>L'échange de quart avec {{otherName}} a été refusé pour la raison suivante :</p>
<p style="margin: 20px 0; color: #ef4444;"><strong>Raison :</strong> {{reason}}</p>
<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p style="margin: 5px 0; color: #1f2937;"><strong>Votre date :</strong> {{yourDate}}</p>
  <p style="margin: 5px 0; color: #1f2937;"><strong>Votre type de quart :</strong> {{yourShiftType}}</p>
  <p style="margin: 5px 0; color: #1f2937;"><strong>Date de l'autre :</strong> {{otherDate}}</p>
  <p style="margin: 5px 0; color: #1f2937;"><strong>Type de quart de l'autre :</strong> {{otherShiftType}}</p>
  {{#if isPartial}}<p style="margin: 5px 0; color: #f97316;"><strong>Échange partiel :</strong> {{yourPartialHours}} <-> {{otherPartialHours}}</p>{{/if}}
</div>
<a href="{{appUrl}}/dashboard/exchanges" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir les demandes d'échange</a>`,
        variables: [
          "name",
          "otherName",
          "yourDate",
          "yourShiftType",
          "otherDate",
          "otherShiftType",
          "reason",
          "isPartial",
          "yourPartialHours",
          "otherPartialHours",
        ],
        description: "Email envoyé aux deux pompiers lorsqu'un échange est refusé",
      },
    ]

    let updated = 0

    for (const template of fallbackTemplates) {
      const existing = await sql`
        SELECT id FROM email_templates WHERE type = ${template.type}
      `

      if (existing.length > 0) {
        await sql`
          UPDATE email_templates
          SET 
            name = ${template.name},
            subject = ${template.subject},
            body = ${template.body},
            variables = ${JSON.stringify(template.variables)}::jsonb,
            description = ${template.description},
            updated_at = CURRENT_TIMESTAMP
          WHERE type = ${template.type}
        `
        updated++
      } else {
        await sql`
          INSERT INTO email_templates (type, name, subject, body, variables, description)
          VALUES (
            ${template.type},
            ${template.name},
            ${template.subject},
            ${template.body},
            ${JSON.stringify(template.variables)}::jsonb,
            ${template.description}
          )
        `
        updated++
      }
    }

    return {
      success: true,
      message: `${updated} templates d'email ont été synchronisés avec succès`,
      updated,
    }
  } catch (error) {
    console.error("[v0] Error syncing email templates:", error)
    return { success: false, error: "Erreur lors de la synchronisation des templates" }
  }
}
