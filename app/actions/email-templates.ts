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
