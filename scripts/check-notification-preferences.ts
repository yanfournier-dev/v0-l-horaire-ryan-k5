import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!, {
  fetchConnectionCache: true,
  disableWarningInBrowsers: true,
})

async function checkPreferences() {
  console.log("Checking notification preferences...")

  // Get Yan Fournier's user info
  const users = await sql`
    SELECT id, first_name, last_name, email, is_admin
    FROM users
    WHERE email LIKE '%yan%' OR email LIKE '%fournier%'
  `

  console.log("\nUsers found:", users)

  if (users.length > 0) {
    const userId = users[0].id

    // Get notification preferences
    const prefs = await sql`
      SELECT *
      FROM notification_preferences
      WHERE user_id = ${userId}
    `

    console.log("\nNotification preferences for", users[0].first_name, users[0].last_name)
    console.log(prefs)

    if (prefs.length === 0) {
      console.log("\n⚠️  No notification preferences found! Creating default preferences...")

      await sql`
        INSERT INTO notification_preferences (
          user_id,
          enable_app,
          enable_email,
          enable_sms,
          notify_replacement_available,
          notify_replacement_accepted,
          notify_replacement_rejected,
          notify_leave_approved,
          notify_leave_rejected,
          notify_schedule_change,
          notify_shift_reminder,
          notify_application_approved
        ) VALUES (
          ${userId},
          true,
          true,
          false,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true
        )
      `

      console.log("✅ Default preferences created!")
    }
  }
}

checkPreferences().catch(console.error)
