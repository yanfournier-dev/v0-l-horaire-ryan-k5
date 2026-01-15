"use client"
import { sql } from "@/lib/db"
import { hashPassword } from "@/app/actions/auth"

export default async function EmergencyResetPage() {
  let result = { success: false, count: 0, error: "" }

  try {
    const hashedPassword = await hashPassword("SSIV2026")

    const users = await sql`
      UPDATE users 
      SET password = ${hashedPassword}
      WHERE id IS NOT NULL
      RETURNING id
    `

    result = { success: true, count: users.length, error: "" }
  } catch (error: any) {
    result = { success: false, count: 0, error: error.message }
  }

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        margin: 0,
        background: "#f5f5f5",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "3rem",
          borderRadius: "12px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          textAlign: "center",
          maxWidth: "500px",
        }}
      >
        <h1 style={{ color: result.success ? "#16a34a" : "#dc2626", marginBottom: "1rem" }}>
          {result.success ? "✓ Réinitialisation réussie" : "✗ Erreur"}
        </h1>

        {result.success ? (
          <>
            <p style={{ color: "#666", marginBottom: "1rem" }}>
              <strong>{result.count} utilisateurs</strong> ont été réinitialisés.
            </p>
            <p style={{ color: "#666", marginBottom: "2rem" }}>
              Mot de passe par défaut: <strong>SSIV2026</strong>
            </p>
            <p style={{ fontSize: "0.9rem", color: "#999" }}>Vous pouvez maintenant vous connecter!</p>
            <div
              style={{
                marginTop: "2rem",
                padding: "1rem",
                background: "#fef3c7",
                borderRadius: "8px",
                color: "#92400e",
              }}
            >
              <strong>IMPORTANT:</strong> Supprimez ces fichiers maintenant:
              <ul style={{ textAlign: "left", marginTop: "0.5rem" }}>
                <li>app/emergency-reset/page.tsx</li>
                <li>app/api/emergency-reset-passwords/route.ts</li>
              </ul>
            </div>
          </>
        ) : (
          <p style={{ color: "#991b1b" }}>Erreur: {result.error}</p>
        )}
      </div>
    </div>
  )
}
