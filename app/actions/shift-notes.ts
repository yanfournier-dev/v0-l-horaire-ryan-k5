"use server"
import { getSession } from "@/app/actions/auth"
import { sql, invalidateCache } from "@/lib/db"

export async function getShiftNote(shiftId: number, shiftDate: string) {
  try {
    const result = await sql`
      SELECT 
        sn.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM shift_notes sn
      LEFT JOIN users u ON sn.created_by = u.id
      WHERE sn.shift_id = ${shiftId} 
      AND sn.shift_date = ${shiftDate}
    `

    return result[0] || null
  } catch (error: any) {
    if (error?.code === "42P01") {
      console.log("[v0] shift_notes table doesn't exist yet - returning null")
      return null
    }
    console.error("[v0] Error fetching shift note:", error)
    return null
  }
}

export async function getShiftNotesForDateRange(startDate: string, endDate: string) {
  try {
    const result = await sql`
      SELECT 
        sn.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM shift_notes sn
      LEFT JOIN users u ON sn.created_by = u.id
      WHERE sn.shift_date >= ${startDate} 
      AND sn.shift_date <= ${endDate}
    `

    return result
  } catch (error: any) {
    if (error?.code === "42P01") {
      console.log("[v0] shift_notes table doesn't exist yet - returning empty array")
      return []
    }
    console.error("[v0] Error fetching shift notes for date range:", error)
    return []
  }
}

export async function createOrUpdateShiftNote(shiftId: number, shiftDate: string, note: string) {
  console.log("[v0] createOrUpdateShiftNote called with:", { shiftId, shiftDate, noteLength: note.length })

  try {
    console.log("[v0] Getting session...")
    const session = await getSession()
    console.log("[v0] Session:", session?.email, "is_admin:", session?.is_admin)

    if (!session?.id) {
      console.log("[v0] No session or user ID")
      return { success: false, error: "Non authentifié" }
    }

    if (!session.is_admin) {
      console.log("[v0] User is not admin")
      return { success: false, error: "Seuls les administrateurs peuvent créer ou modifier des notes" }
    }

    if (!note.trim()) {
      console.log("[v0] Note is empty")
      return { success: false, error: "La note ne peut pas être vide" }
    }

    console.log("[v0] Checking if note exists...")
    // Check if note already exists
    const existing = await sql`
      SELECT id FROM shift_notes 
      WHERE shift_id = ${shiftId} AND shift_date = ${shiftDate}
    `
    console.log("[v0] Existing note check result:", existing.length > 0 ? "exists" : "new")

    if (existing.length > 0) {
      console.log("[v0] Updating existing note...")
      // Update existing note
      await sql`
        UPDATE shift_notes 
        SET note = ${note.trim()}, updated_at = CURRENT_TIMESTAMP
        WHERE shift_id = ${shiftId} AND shift_date = ${shiftDate}
      `
      console.log("[v0] Note updated successfully")
    } else {
      console.log("[v0] Creating new note...")
      // Create new note
      await sql`
        INSERT INTO shift_notes (shift_id, shift_date, note, created_by)
        VALUES (${shiftId}, ${shiftDate}, ${note.trim()}, ${session.id})
      `
      console.log("[v0] Note created successfully")
    }

    console.log("[v0] Returning success")

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error in createOrUpdateShiftNote:", error)
    console.error("[v0] Error code:", error?.code)
    console.error("[v0] Error message:", error?.message)

    if (error?.code === "42P01") {
      console.log("[v0] Table doesn't exist error")
      return {
        success: false,
        error: "La table shift_notes n'existe pas encore. Veuillez exécuter le script SQL 023-create-shift-notes.sql",
      }
    }
    console.log("[v0] Generic error, returning error message")
    return {
      success: false,
      error: "Erreur lors de la sauvegarde de la note: " + (error?.message || "Erreur inconnue"),
    }
  }
}

export async function deleteShiftNote(shiftId: number, shiftDate: string) {
  try {
    const session = await getSession()
    if (!session?.id) {
      return { success: false, error: "Non authentifié" }
    }

    if (!session.is_admin) {
      return { success: false, error: "Seuls les administrateurs peuvent supprimer des notes" }
    }

    await sql`
      DELETE FROM shift_notes 
      WHERE shift_id = ${shiftId} AND shift_date = ${shiftDate}
    `

    try {
      invalidateCache()
    } catch (cacheError) {
      console.error("[v0] Error invalidating cache:", cacheError)
    }

    return { success: true }
  } catch (error: any) {
    if (error?.code === "42P01") {
      return {
        success: false,
        error: "La table shift_notes n'existe pas encore. Veuillez exécuter le script SQL 023-create-shift-notes.sql",
      }
    }
    console.error("[v0] Error deleting shift note:", error)
    return { success: false, error: "Erreur lors de la suppression de la note" }
  }
}
