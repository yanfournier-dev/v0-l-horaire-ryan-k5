import { sql } from "your-sql-library" // Import the sql library

export async function getAllFirefighters() {
  try {
    const firefighters = await sql`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        t.name as team_name
      FROM users u
      LEFT JOIN team_members tm ON u.id = tm.user_id
      LEFT JOIN teams t ON tm.team_id = t.id
      WHERE u.role IN ('firefighter', 'captain', 'lieutenant')
      ORDER BY u.last_name, u.first_name
    `

    return firefighters
  } catch (error) {
    console.error("Error getting firefighters:", error)
    return []
  }
}
