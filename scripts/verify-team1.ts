import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!, {
  fetchConnectionCache: true,
  disableWarningInBrowsers: true,
})

async function verifyTeam1() {
  console.log("[v0] Verifying Team 1 data...")

  try {
    // Check all users
    const allUsers = await sql`
      SELECT id, first_name, last_name, email, role
      FROM users
      ORDER BY last_name
    `
    console.log(`[v0] Total users in database: ${allUsers.length}`)
    allUsers.forEach((user) => {
      console.log(`[v0] - ${user.first_name} ${user.last_name} (${user.email}) - ${user.role}`)
    })

    // Check Team 1
    const team1 = await sql`
      SELECT * FROM teams WHERE name = 'Équipe 1'
    `
    if (team1.length > 0) {
      console.log(`[v0] Team 1 found with ID: ${team1[0].id}`)

      // Check team members
      const members = await sql`
        SELECT u.first_name, u.last_name, u.email
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ${team1[0].id}
      `
      console.log(`[v0] Team 1 has ${members.length} members:`)
      members.forEach((member) => {
        console.log(`[v0] - ${member.first_name} ${member.last_name} (${member.email})`)
      })
    } else {
      console.log("[v0] Team 1 not found!")
    }
  } catch (error) {
    console.error("[v0] Verification failed:", error)
  }
}

verifyTeam1()
